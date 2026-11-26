import { prisma } from "@/lib/prisma";
import { attachVenuesToTickets, summarizeTicketVenues, deriveRegistrationTypeLabel, formatPaymentStatusLabel } from "@/lib/tickets";
import { sendTicketConfirmationEmail } from "@/lib/email";
import { REGISTRATION_CATEGORIES } from "@/lib/types";
import { format } from "date-fns";

// The single path for emailing a registration's ticket pack: after a payment
// completes it, after an approval, after an amendment, and for a manual or
// bulk reissue. It always reloads the registration so the email carries the
// current ACTIVE tickets only (never cancelled ones), and it records the
// outcome on the registration so staff can see who has and hasn't received
// their tickets instead of a failure vanishing into the server log.

export type TicketEmailOutcome =
  | { status: "sent"; to: string; ticketCount: number }
  | { status: "skipped"; reason: string }
  | { status: "failed"; to: string; ticketCount: number; error: string };

/** Stored at formData.ticketEmail. JSON, so no migration needed. */
export interface TicketEmailRecord {
  lastAttemptAt: string;
  lastStatus: "sent" | "failed";
  lastError?: string | null;
  lastSentAt?: string | null;
  lastSentTo?: string | null;
  ticketCount: number;
  sentCount: number;
}

export function isUsableEmail(email: string | null | undefined): email is string {
  return !!email && email !== "unknown" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

/** Turns an SMTP / PDF exception into one line a staff member can act on. */
export function describeEmailError(err: unknown): string {
  const e = err as any;
  const parts = [e?.responseCode ? `SMTP ${e.responseCode}` : null, e?.response || e?.message || String(err)];
  return parts.filter(Boolean).join(": ").replace(/\s+/g, " ").slice(0, 300);
}

export async function sendRegistrationTickets(id: string): Promise<TicketEmailOutcome> {
  const registration = await prisma.registration.findUnique({
    where: { id },
    include: {
      tickets: {
        where: { status: "ACTIVE" },
        select: {
          ticketNumber: true,
          ticketType: true,
          attendee: { select: { firstName: true, lastName: true } },
        },
        orderBy: { ticketNumber: "asc" },
      },
      venue: { select: { name: true, city: true } },
      venueAllocations: { include: { venue: { select: { name: true, city: true } } } },
      event: { select: { name: true, startDate: true } },
      church: { select: { name: true, district: true, country: true } },
      payments: { where: { status: "CONFIRMED" }, select: { amount: true } },
    },
  });

  if (!registration) return { status: "skipped", reason: "Registration not found" };
  if (registration.paymentStatus !== "COMPLETED") return { status: "skipped", reason: "Not fully paid" };
  if (registration.tickets.length === 0) return { status: "skipped", reason: "No active tickets" };
  if (!isUsableEmail(registration.email)) {
    return { status: "skipped", reason: `No valid email address on file (${registration.email || "blank"})` };
  }

  const to = registration.email.trim();
  const formData = (registration.formData ?? {}) as Record<string, any>;
  const registrantName =
    registration.church?.name ||
    formData?.pastorName ||
    (formData?.firstName ? `${formData.firstName} ${formData.lastName ?? ""}`.trim() : null) ||
    registration.registrarName ||
    to;

  const totalPaid = registration.payments.reduce((sum, p) => sum + p.amount, 0);
  const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === registration.category);
  const ticketsWithVenue = attachVenuesToTickets(registration.tickets, registration.venueAllocations).map((t) => ({
    ...t,
    attendeeName: t.attendee ? `${t.attendee.firstName} ${t.attendee.lastName}`.trim() : undefined,
  }));
  const ticketCount = ticketsWithVenue.length;

  let outcome: TicketEmailOutcome;
  try {
    await sendTicketConfirmationEmail({
      to,
      registrantName: String(registrantName),
      registrationId: registration.registrationId,
      category: catInfo?.name ?? registration.category,
      categoryId: registration.category,
      registrationType: deriveRegistrationTypeLabel(registration.type, registration.category),
      churchName: registration.church?.name,
      district: registration.church?.district ?? undefined,
      country: registration.church?.country,
      paymentStatusLabel: formatPaymentStatusLabel(registration.fee, totalPaid),
      eventName: registration.event?.name ?? "AOG Fiji 100th Anniversary",
      eventDate: registration.event?.startDate
        ? format(new Date(registration.event.startDate), "d MMMM yyyy")
        : "TBC",
      venueName: summarizeTicketVenues(ticketsWithVenue) || registration.venue?.name || "",
      venueCity: registration.venue?.city ?? "",
      tickets: ticketsWithVenue,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    });
    outcome = { status: "sent", to, ticketCount };
  } catch (err) {
    console.error(`Ticket email failed for ${registration.registrationId}:`, err);
    outcome = { status: "failed", to, ticketCount, error: describeEmailError(err) };
  }

  await recordTicketEmail(id, formData.ticketEmail as TicketEmailRecord | undefined, outcome).catch((err) =>
    console.error(`Could not record ticket email outcome for ${registration.registrationId}:`, err)
  );
  return outcome;
}

async function recordTicketEmail(
  id: string,
  prev: TicketEmailRecord | undefined,
  outcome: Extract<TicketEmailOutcome, { status: "sent" | "failed" }>
) {
  const now = new Date().toISOString();
  const record: TicketEmailRecord = {
    lastAttemptAt: now,
    lastStatus: outcome.status,
    lastError: outcome.status === "failed" ? outcome.error : null,
    lastSentAt: outcome.status === "sent" ? now : prev?.lastSentAt ?? null,
    lastSentTo: outcome.status === "sent" ? outcome.to : prev?.lastSentTo ?? null,
    ticketCount: outcome.ticketCount,
    sentCount: (prev?.sentCount ?? 0) + (outcome.status === "sent" ? 1 : 0),
  };
  // jsonb_set rather than read-modify-write of the whole formData, so this
  // can't clobber an amendment audit entry written in the meantime.
  await prisma.$executeRaw`
    UPDATE "Registration"
    SET "formData" = jsonb_set(COALESCE("formData", '{}'::jsonb), '{ticketEmail}', ${JSON.stringify(record)}::jsonb, true)
    WHERE id = ${id}`;
}
