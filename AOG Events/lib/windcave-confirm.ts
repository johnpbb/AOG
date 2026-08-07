import { prisma } from "@/lib/prisma";
import { sendTicketConfirmationEmail } from "@/lib/email";
import { getWindcaveSession, isWindcaveApproved, windcaveTransactionId } from "@/lib/windcave-client";
import { generateTicketsForRegistration, attachVenuesToTickets, summarizeTicketVenues } from "@/lib/tickets";
import { REGISTRATION_CATEGORIES } from "@/lib/types";
import { format } from "date-fns";

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
    include: { attendees: true, event: true, venue: true },
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
    include: {
      attendees: true,
      tickets: { select: { ticketNumber: true, ticketType: true } },
      event: true,
      venue: true,
      venueAllocations: { include: { venue: { select: { name: true, city: true } } } },
    },
  });

  // Issue entry QR tickets now that payment is confirmed (idempotent).
  let tickets = updated.tickets;
  if (tickets.length === 0) {
    tickets = await prisma.$transaction((tx) =>
      generateTicketsForRegistration(tx, updated.id, updated.adults, updated.youth)
    );
  }

  const name =
    updated.attendees.length > 0
      ? `${updated.attendees[0].firstName} ${updated.attendees[0].lastName}`
      : "Attendee";

  const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === updated.category);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const ticketsWithVenue = attachVenuesToTickets(tickets, updated.venueAllocations);

  // Fire-and-forget so the response isn't blocked on SMTP.
  sendTicketConfirmationEmail({
    to: updated.email,
    registrantName: name,
    registrationId: updated.registrationId,
    category: catInfo?.name ?? updated.category,
    eventName: updated.event?.name ?? "AOG Fiji 100th Anniversary",
    eventDate: updated.event?.startDate ? format(new Date(updated.event.startDate), "d MMMM yyyy") : "TBC",
    venueName: summarizeTicketVenues(ticketsWithVenue) || updated.venue?.name || "",
    venueCity: updated.venue?.city ?? "",
    tickets: ticketsWithVenue,
    appUrl,
  }).catch((err) => console.error("Background Email Error (Windcave):", err));

  return { status: "success", message: "Payment verified successfully" };
}
