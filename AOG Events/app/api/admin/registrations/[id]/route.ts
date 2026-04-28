import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, TicketStatus } from "@prisma/client";

// DELETE /api/admin/registrations/[id]
// Cancels a registration: marks it CANCELLED, cancels all tickets, returns seats to pool
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch the registration with its tickets
      const registration = await tx.registration.findUnique({
        where: { id },
        include: {
          tickets: { select: { id: true, status: true } },
          venue: { select: { id: true, name: true } },
        },
      });

      if (!registration) {
        throw new Error("NOT_FOUND");
      }

      if (registration.paymentStatus === PaymentStatus.CANCELLED) {
        throw new Error("ALREADY_CANCELLED");
      }

      const activeTicketCount = registration.tickets.filter(
        (t) => t.status === TicketStatus.ACTIVE
      ).length;

      // 2. Mark registration as CANCELLED
      await tx.registration.update({
        where: { id },
        data: { paymentStatus: PaymentStatus.CANCELLED },
      });

      // 3. Cancel all active tickets (invalidates QR codes immediately)
      await tx.ticket.updateMany({
        where: { registrationId: id, status: TicketStatus.ACTIVE },
        data: { status: TicketStatus.CANCELLED },
      });

      // 4. Return seats to venue counter
      if (registration.venueId && activeTicketCount > 0) {
        await tx.venue.update({
          where: { id: registration.venueId },
          data: {
            currentRegistrations: { decrement: activeTicketCount },
          },
        });
      }

      return {
        registrationId: registration.registrationId,
        ticketsCancelled: activeTicketCount,
        venueName: registration.venue?.name ?? registration.venueId,
      };
    });

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
