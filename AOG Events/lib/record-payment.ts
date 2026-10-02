import { prisma } from "@/lib/prisma";
import { generateTicketsForRegistration, attachVenuesToTickets, summarizeTicketVenues, deriveRegistrationTypeLabel, formatPaymentStatusLabel } from "@/lib/tickets";
import { sendFinanceNotificationEmail, sendBalanceUpdateEmail, sendTicketConfirmationEmail } from "@/lib/email";
import { REGISTRATION_CATEGORIES } from "@/lib/types";
import { format } from "date-fns";

export class RecordPaymentError extends Error {
  constructor(public code: "NOT_FOUND" | "CANCELLED") {
    super(code);
  }
}

export interface RecordPaymentInput {
  /** Registration primary key (cuid), not the AG100-… reference. */
  registrationId: string;
  amount: number;
  entryType?: string;
  method?: string;
  referenceNote?: string | null;
  installmentNo?: number | null;
  confirmedBy: { id: string; name: string };
}

// Logs a payment receipt (full or installment). Once the running total reaches
// the registration fee, the registration flips to COMPLETED and entry QR
// tickets are generated (only adults/youth — never kids). Shared by the
// Manual Override Box and the bank statement import so both take the same path.
export async function recordPayment(input: RecordPaymentInput) {
  const { registrationId: id, confirmedBy } = input;

  const result = await prisma.$transaction(async (tx) => {
    const registration = await tx.registration.findUnique({
      where: { id },
      include: {
        payments: true,
        tickets: { include: { attendee: { select: { firstName: true, lastName: true } } } },
        venue: true,
        venueAllocations: { include: { venue: { select: { name: true, city: true } } } },
        event: true,
        church: true,
        attendees: { select: { id: true, ageCategory: true } },
      },
    });
    if (!registration) throw new RecordPaymentError("NOT_FOUND");
    if (registration.paymentStatus === "CANCELLED") throw new RecordPaymentError("CANCELLED");

    const payment = await tx.payment.create({
      data: {
        registrationId: id,
        amount: input.amount,
        entryType: input.entryType === "INSTALLMENT" ? "INSTALLMENT" : "FULL",
        // Whitelist rather than trusting the posted string: an unknown
        // value silently becoming BANK_TRANSFER would misfile where the
        // money actually landed.
        method: ["CASH", "ONLINE", "MPAISA", "WORLD_REMIT"].includes(input.method ?? "") ? (input.method as any) : "BANK_TRANSFER",
        referenceNote: input.referenceNote || null,
        installmentNo: input.installmentNo ?? null,
        confirmedById: confirmedBy.id,
      },
      include: { confirmedBy: { select: { name: true } } },
    });

    const priorPaid = registration.payments
      .filter((p) => p.status === "CONFIRMED")
      .reduce((sum, p) => sum + p.amount, 0);
    const totalPaid = priorPaid + payment.amount;
    const fullyPaid = totalPaid >= registration.fee;

    let tickets = registration.tickets;
    if (fullyPaid && registration.paymentStatus !== "COMPLETED") {
      await tx.registration.update({ where: { id }, data: { paymentStatus: "COMPLETED" } });
      if (registration.tickets.length === 0) {
        tickets = await generateTicketsForRegistration(tx, id, registration.adults, registration.youth, registration.attendees);
      }
    }

    return { registration, payment, totalPaid, fullyPaid, tickets };
  });

  // ── Notifications (best-effort, don't fail the payment if email fails) ──
  const siteConfig = await prisma.siteConfig.findUnique({ where: { id: "default" } });
  const remainingBalance = Math.max(0, result.registration.fee - result.totalPaid);
  const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === result.registration.category);

  const formData = result.registration.formData as Record<string, any>;
  const registrantName =
    result.registration.church?.name ||
    formData?.pastorName ||
    (formData?.firstName ? `${formData.firstName} ${formData.lastName ?? ""}`.trim() : null) ||
    result.registration.registrarName ||
    result.registration.email;
  const ticketsWithVenue = attachVenuesToTickets(result.tickets, result.registration.venueAllocations).map((t) => ({
    ...t,
    attendeeName: t.attendee ? `${t.attendee.firstName} ${t.attendee.lastName}`.trim() : undefined,
  }));

  await Promise.allSettled([
    siteConfig?.financeNotificationEmail
      ? sendFinanceNotificationEmail({
          to: siteConfig.financeNotificationEmail,
          registrationId: result.registration.registrationId,
          registrantName: String(registrantName),
          amount: result.payment.amount,
          totalPaid: result.totalPaid,
          remainingBalance,
          confirmedByName: confirmedBy.name,
        })
      : Promise.resolve(),
    result.registration.email && result.registration.email !== "unknown"
      ? sendBalanceUpdateEmail({
          to: result.registration.email,
          registrationId: result.registration.registrationId,
          amountReceived: result.payment.amount,
          totalPaid: result.totalPaid,
          remainingBalance,
          fullyPaid: result.fullyPaid,
        })
      : Promise.resolve(),
    result.fullyPaid && result.registration.email !== "unknown"
      ? sendTicketConfirmationEmail({
          to: result.registration.email,
          registrantName: result.registration.registrarName || result.registration.email,
          registrationId: result.registration.registrationId,
          category: catInfo?.name ?? result.registration.category,
          categoryId: result.registration.category,
          registrationType: deriveRegistrationTypeLabel(result.registration.type, result.registration.category),
          churchName: result.registration.church?.name,
          district: result.registration.church?.district ?? undefined,
          country: result.registration.church?.country,
          paymentStatusLabel: formatPaymentStatusLabel(result.registration.fee, result.totalPaid),
          eventName: result.registration.event?.name ?? "AOG Fiji 100th Anniversary",
          eventDate: result.registration.event?.startDate
            ? format(new Date(result.registration.event.startDate), "d MMMM yyyy")
            : "TBC",
          venueName: summarizeTicketVenues(ticketsWithVenue) || result.registration.venue?.name || "",
          venueCity: result.registration.venue?.city ?? "",
          tickets: ticketsWithVenue,
          appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        })
      : Promise.resolve(),
  ]);

  return {
    payment: result.payment,
    totalPaid: result.totalPaid,
    remainingBalance,
    fullyPaid: result.fullyPaid,
  };
}
