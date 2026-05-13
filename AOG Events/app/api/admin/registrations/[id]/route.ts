import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, TicketStatus } from "@prisma/client";
import { sendTicketConfirmationEmail } from "@/lib/email";
import { format } from "date-fns";
import { REGISTRATION_CATEGORIES } from "@/lib/types";

// PATCH /api/admin/registrations/[id] — approve a pending bank transfer registration
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const registration = await prisma.registration.findUnique({
      where: { id },
      include: {
        tickets: { select: { ticketNumber: true }, orderBy: { ticketNumber: "asc" } },
        venue: { select: { name: true, city: true } },
        event: { select: { name: true, startDate: true } },
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

    await prisma.registration.update({
      where: { id },
      data: { paymentStatus: PaymentStatus.COMPLETED },
    });

    // Send tickets confirmation email
    const formData = registration.formData as Record<string, any>;
    const registrantName =
      formData?.pastorName ||
      (formData?.firstName ? `${formData.firstName} ${formData.lastName ?? ""}`.trim() : null) ||
      registration.email;

    const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === registration.category);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    await sendTicketConfirmationEmail({
      to: registration.email,
      registrantName: String(registrantName),
      registrationId: registration.registrationId,
      category: catInfo?.name ?? registration.category,
      eventName: registration.event?.name ?? "AOG Fiji 100th Anniversary",
      eventDate: registration.event?.startDate
        ? format(new Date(registration.event.startDate), "d MMMM yyyy")
        : "TBC",
      venueName: registration.venue?.name ?? "",
      venueCity: registration.venue?.city ?? "",
      tickets: registration.tickets,
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
