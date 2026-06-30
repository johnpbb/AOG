import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmWindcavePayment } from "@/lib/windcave-confirm";

// Windcave Fail-Proof Result Notification (FPRN).
// Windcave calls this server-to-server when a session resolves. We re-query the
// session (never trust the payload alone) and reconcile against our DB. A 200
// acknowledges receipt so Windcave stops retrying; 500 asks it to retry.
async function handle(sessionId: string | null) {
  if (!sessionId) {
    return NextResponse.json({ received: true, note: "no sessionId" });
  }

  const registration = await prisma.registration.findFirst({
    where: { paymentSessionId: sessionId },
    select: { registrationId: true },
  });

  if (!registration) {
    // Unknown session — acknowledge so Windcave doesn't keep retrying.
    return NextResponse.json({ received: true, note: "unknown session" });
  }

  const outcome = await confirmWindcavePayment(registration.registrationId, sessionId);
  return NextResponse.json({ received: true, status: outcome.status });
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      // Fall back to a JSON or form-encoded body.
      const ct = request.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const body = await request.json().catch(() => ({}));
        sessionId = body.sessionId || body.id || null;
      } else {
        const form = await request.formData().catch(() => null);
        sessionId = (form?.get("sessionId") as string) || (form?.get("id") as string) || null;
      }
    }

    return await handle(sessionId);
  } catch (error: any) {
    console.error("Windcave Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Windcave may also probe the notification URL with GET.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return handle(searchParams.get("sessionId"));
}
