import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateTicketsForRegistration, attachVenuesToTickets, summarizeTicketVenues, deriveRegistrationTypeLabel, formatPaymentStatusLabel } from "@/lib/tickets";
import { sendFinanceNotificationEmail, sendBalanceUpdateEmail, sendTicketConfirmationEmail } from "@/lib/email";
import { REGISTRATION_CATEGORIES } from "@/lib/types";
import { format } from "date-fns";

// GET /api/admin/registrations/[id]/payments — the append-only audit trail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payments = await prisma.payment.findMany({
    where: { registrationId: id },
    include: { confirmedBy: { select: { name: true } } },
    orderBy: { confirmedAt: "asc" },
  });
  return NextResponse.json({ payments });
}

// POST /api/admin/registrations/[id]/payments — the Manual Override Box:
// Finance logs a payment receipt (full or installment). Once the running
// total reaches the registration fee, the registration flips to COMPLETED
// and entry QR tickets are generated (only adults/youth — never kids).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { amount, entryType, method, referenceNote, installmentNo } = await req.json();

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "A positive payment amount is required" }, { status: 400 });
  }

  try {
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
      if (!registration) throw new Error("NOT_FOUND");
      if (registration.paymentStatus === "CANCELLED") throw new Error("CANCELLED");

      const payment = await tx.payment.create({
        data: {
          registrationId: id,
          amount: parseFloat(String(amount)),
          entryType: entryType === "INSTALLMENT" ? "INSTALLMENT" : "FULL",
          method: method === "CASH" ? "CASH" : method === "ONLINE" ? "ONLINE" : "BANK_TRANSFER",
          referenceNote: referenceNote || null,
          installmentNo: installmentNo ? parseInt(String(installmentNo), 10) : null,
          confirmedById: currentUser.id,
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

    // ── Notifications (best-effort, don't fail the request if email fails) ──
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
            confirmedByName: currentUser.name,
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

    return NextResponse.json({
      success: true,
      payment: result.payment,
      totalPaid: result.totalPaid,
      remainingBalance,
      fullyPaid: result.fullyPaid,
    });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }
    if (error.message === "CANCELLED") {
      return NextResponse.json({ error: "Cannot log a payment against a cancelled registration" }, { status: 409 });
    }
    console.error("Log payment error:", error);
    return NextResponse.json({ error: "Failed to log payment" }, { status: 500 });
  }
}
