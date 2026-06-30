// Windcave Hosted Payment Page (HPP) — server-side REST client (SAQ-A).
// Mirrors the role of lib/anz-egate-client.ts but for the redirect-based
// Windcave flow. All credentials stay server-side; the browser only ever
// receives the HPP redirect URL.

const BASE_URL = process.env.WINDCAVE_API_BASE_URL || "https://sec.windcave.com/api/v1";

export const WINDCAVE_CURRENCY = process.env.WINDCAVE_CURRENCY || "FJD";

function authHeader(): string {
  const username = process.env.WINDCAVE_API_USERNAME;
  const apiKey = process.env.WINDCAVE_API_KEY;
  if (!username || !apiKey) {
    throw new Error("Windcave credentials not configured");
  }
  return "Basic " + Buffer.from(`${username}:${apiKey}`).toString("base64");
}

export interface WindcaveLink {
  href: string;
  rel: string;
  method: string;
}

export interface WindcaveSession {
  id: string;
  state?: string;
  links?: WindcaveLink[];
  transactions?: Array<{
    id?: string;
    authorised?: boolean;
    allowRetry?: boolean;
    type?: string;
    responseText?: string;
    responseCode?: string;
  }>;
}

interface CreateSessionArgs {
  registrationId: string;
  amount: number;
  customerEmail?: string;
  approvedUrl: string;
  declinedUrl: string;
  cancelledUrl: string;
  notificationUrl?: string;
}

/**
 * Create a Windcave HPP session. Returns the session id plus the HPP URL the
 * browser should be redirected to.
 */
export async function createWindcaveSession(args: CreateSessionArgs): Promise<{ sessionId: string; hppUrl: string }> {
  const payload: Record<string, unknown> = {
    type: "purchase",
    amount: Number(args.amount).toFixed(2),
    currency: WINDCAVE_CURRENCY,
    merchantReference: args.registrationId,
    callbackUrls: {
      approved: args.approvedUrl,
      declined: args.declinedUrl,
      cancelled: args.cancelledUrl,
    },
  };
  if (args.notificationUrl) payload.notificationUrl = args.notificationUrl;
  if (args.customerEmail) payload.customer = { email: args.customerEmail };

  const res = await fetch(`${BASE_URL}/sessions`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data: WindcaveSession = await res.json().catch(() => ({} as WindcaveSession));

  if (!res.ok || !data?.id) {
    throw new Error(`Windcave session creation failed (${res.status}): ${JSON.stringify(data)}`);
  }

  // The redirect link is the one Windcave flags as the hosted payment page.
  const hpp =
    data.links?.find((l) => l.rel?.toLowerCase() === "hpp") ??
    data.links?.find((l) => l.method?.toUpperCase() === "REDIRECT") ??
    data.links?.find((l) => l.rel?.toLowerCase() !== "self");

  if (!hpp?.href) {
    throw new Error(`Windcave session created but no HPP link returned: ${JSON.stringify(data)}`);
  }

  return { sessionId: data.id, hppUrl: hpp.href };
}

/** Fetch a session's current status from Windcave. */
export async function getWindcaveSession(sessionId: string): Promise<WindcaveSession> {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}`, {
    method: "GET",
    headers: { Authorization: authHeader() },
  });
  const data: WindcaveSession = await res.json().catch(() => ({} as WindcaveSession));
  if (!res.ok) {
    throw new Error(`Windcave session lookup failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

/** True when the session has a successful, authorised purchase transaction. */
export function isWindcaveApproved(session: WindcaveSession): boolean {
  if (session.transactions?.some((t) => t.authorised === true)) return true;
  const state = session.state?.toLowerCase();
  return state === "approved" || state === "complete";
}

/** The authorised transaction id, for storing as the payment reference. */
export function windcaveTransactionId(session: WindcaveSession): string | undefined {
  return session.transactions?.find((t) => t.authorised === true)?.id ?? session.transactions?.[0]?.id;
}
