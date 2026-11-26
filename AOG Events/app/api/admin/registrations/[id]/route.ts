import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { generateTicketsForRegistration } from "@/lib/tickets";
import { sendRegistrationTickets } from "@/lib/send-registration-tickets";
import { getCurrentUser } from "@/lib/auth";
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
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    // Email the tickets. The approval is already committed, so a mail
    // failure is reported alongside success rather than as a 500 that makes
    // staff think the approval itself failed (and click Approve again).
    const ticketEmail = await sendRegistrationTickets(id);
    const emailNote =
      ticketEmail.status === "sent"
        ? `Tickets emailed to ${ticketEmail.to}.`
        : ticketEmail.status === "failed"
          ? `The tickets could not be emailed: ${ticketEmail.error}. Use "Resend tickets" to try again.`
          : `No tickets were emailed: ${ticketEmail.reason}.`;

    return NextResponse.json({
      success: true,
      ticketEmail,
      message: `Registration ${registration.registrationId} approved. ${emailNote}`,
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
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
