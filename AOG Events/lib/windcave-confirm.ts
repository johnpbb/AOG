import { prisma } from "@/lib/prisma";
import { sendConfirmationEmail } from "@/lib/mail";
import { getWindcaveSession, isWindcaveApproved, windcaveTransactionId } from "@/lib/windcave-client";
import { generateTicketsForRegistration } from "@/lib/tickets";

export interface ConfirmResult {
  status: "success" | "failed" | "not_found";
  message: string;
}

/**
 * Reconcile a Windcave payment against our DB. Idempotent: if the registration
 * is already COMPLETED it is treated as success without re-sending the email.
 * Shared by the browser-return verify route and the FPRN webhook.
 */
export async function confirmWindcavePayment(regId: string, sessionId?: string): Promise<ConfirmResult> {
  const registration = await prisma.registration.findUnique({
    where: { registrationId: regId },
    include: { attendees: true },
  });

  if (!registration) {
    return { status: "not_found", message: "Registration not found" };
  }

  if (registration.paymentStatus === "COMPLETED") {
    return { status: "success", message: "Payment already confirmed" };
  }

  const lookupId = sessionId || registration.paymentSessionId;
  if (!lookupId) {
    return { status: "failed", message: "No Windcave session associated with this registration" };
  }

  const session = await getWindcaveSession(lookupId);

  if (!isWindcaveApproved(session)) {
    const reason = session.transactions?.[0]?.responseText || session.state || "not authorised";
    return { status: "failed", message: `Payment ${reason}` };
  }

  const updated = await prisma.registration.update({
    where: { registrationId: regId },
    data: {
      paymentStatus: "COMPLETED",
      paymentSessionId: lookupId,
      paymentRef: windcaveTransactionId(session) ?? registration.paymentRef,
    },
    include: { attendees: true, tickets: { select: { id: true } } },
  });

  // Issue entry QR tickets now that payment is confirmed (idempotent).
  if (updated.tickets.length === 0) {
    await prisma.$transaction((tx) =>
      generateTicketsForRegistration(tx, updated.id, updated.numberOfAttendees, 0)
    );
  }

  const name =
    updated.attendees.length > 0
      ? `${updated.attendees[0].firstName} ${updated.attendees[0].lastName}`
      : "Attendee";

  // Fire-and-forget so the response isn't blocked on SMTP.
  sendConfirmationEmail(updated.email, updated.registrationId, name, updated.category).catch((err) =>
    console.error("Background Email Error (Windcave):", err),
  );

  return { status: "success", message: "Payment verified successfully" };
}
