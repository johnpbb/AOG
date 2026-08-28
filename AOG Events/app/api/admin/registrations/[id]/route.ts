import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { sendTicketConfirmationEmail } from "@/lib/email";
import { generateTicketsForRegistration, attachVenuesToTickets, summarizeTicketVenues, deriveRegistrationTypeLabel, formatPaymentStatusLabel } from "@/lib/tickets";
import { getCurrentUser } from "@/lib/auth";
import { format } from "date-fns";
import { REGISTRATION_CATEGORIES } from "@/lib/types";
import { cancelRegistration } from "@/lib/cancel-registration";

// PATCH /api/admin/registrations/[id] — one-click approve for a pending bank
// transfer registration. Internally logs a FULL Payment row (rather than
// just flipping the status flag) so every completion — old flow and new
// ledger-driven flow alike — shares the same "Confirmed by" audit trail.
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  try {
    const registration = await prisma.registration.findUnique({
      where: { id },
      include: {
        tickets: {
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
        attendees: { select: { id: true, ageCategory: true } },
        church: { select: { name: true, district: true, country: true } },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    if (registration.paymentStatus === PaymentStatus.COMPLETED) {
      return NextResponse.json({ error: "Registration is already approved" }, { status: 409 });
    }

    if (registration.paymentStatus === PaymentStatus.CANCELLED) {
      return NextResponse.json({ error: "Cannot approve a cancelled registration" }, { status: 409 });
    }

    let tickets = registration.tickets;
    await prisma.$transaction(async (tx) => {
      await tx.registration.update({
        where: { id },
        data: { paymentStatus: PaymentStatus.COMPLETED },
      });
      await tx.payment.create({
        data: {
          registrationId: id,
          amount: registration.fee,
          entryType: "FULL",
          method: registration.paymentMethod,
          referenceNote: "Approved via one-click registration approval",
          confirmedById: currentUser?.id ?? null,
        },
      });
      if (tickets.length === 0) {
        tickets = await generateTicketsForRegistration(
          tx,
          id,
          registration.adults || registration.numberOfAttendees,
          registration.youth,
          registration.attendees
        );
      }
    });

    // Send tickets confirmation email
    const formData = registration.formData as Record<string, any>;
    const registrantName =
      formData?.pastorName ||
      (formData?.firstName ? `${formData.firstName} ${formData.lastName ?? ""}`.trim() : null) ||
      registration.email;

    const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === registration.category);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const ticketsWithVenue = attachVenuesToTickets(tickets, registration.venueAllocations).map((t) => ({
      ...t,
      attendeeName: t.attendee ? `${t.attendee.firstName} ${t.attendee.lastName}`.trim() : undefined,
    }));

    // This approval path always logs a single FULL Payment, so the
    // registration is always fully paid by the time we get here.
    await sendTicketConfirmationEmail({
      to: registration.email,
      registrantName: String(registrantName),
      registrationId: registration.registrationId,
      category: catInfo?.name ?? registration.category,
      registrationType: deriveRegistrationTypeLabel(registration.type, registration.category),
      churchName: registration.church?.name,
      district: registration.church?.district ?? undefined,
      country: registration.church?.country,
      paymentStatusLabel: formatPaymentStatusLabel(registration.fee, registration.fee),
      eventName: registration.event?.name ?? "AOG Fiji 100th Anniversary",
      eventDate: registration.event?.startDate
        ? format(new Date(registration.event.startDate), "d MMMM yyyy")
        : "TBC",
      venueName: summarizeTicketVenues(ticketsWithVenue) || registration.venue?.name || "",
      venueCity: registration.venue?.city ?? "",
      tickets: ticketsWithVenue,
      appUrl,
    });

    return NextResponse.json({
      success: true,
      message: `Registration ${registration.registrationId} approved. Tickets emailed to ${registration.email}.`,
    });
  } catch (error: any) {
    console.error("Approve registration error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/registrations/[id]
// Cancels a registration: marks it CANCELLED, cancels all tickets, returns seats to pool
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await prisma.$transaction((tx) => cancelRegistration(tx, id));

    return NextResponse.json({
      success: true,
      message: `Registration ${result.registrationId} cancelled. ${result.ticketsCancelled} ticket(s) invalidated.`,
      ...result,
    });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }
    if (error.message === "ALREADY_CANCELLED") {
      return NextResponse.json({ error: "Registration is already cancelled" }, { status: 409 });
    }
    console.error("Cancel registration error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
