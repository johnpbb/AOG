// Short-lived signed token proving a registrant passed the code+contact
// lookup check in /api/register/lookup, so /api/register/amend doesn't have
// to re-accept raw contact info as a second guessable auth surface. Same
// signing approach as lib/session.ts, but a distinct purpose tag and a much
// shorter expiry — this is not an admin session.
import crypto from "crypto";

const AMEND_TOKEN_MAX_AGE_SECONDS = 20 * 60; // 20 minutes

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return secret;
}

interface AmendTokenPayload {
  purpose: "amend";
  registrationId: string; // internal cuid, not the human-facing registrationId code
  exp: number;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createAmendToken(registrationId: string): string {
  const payload: AmendTokenPayload = {
    purpose: "amend",
    registrationId,
    exp: Math.floor(Date.now() / 1000) + AMEND_TOKEN_MAX_AGE_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyAmendToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  if (sign(body) !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as AmendTokenPayload;
    if (payload.purpose !== "amend") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.registrationId;
  } catch {
    return null;
  }
}
