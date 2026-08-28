import type { Prisma, PrismaClient } from "@prisma/client";
import { PaymentStatus, TicketStatus } from "@prisma/client";
import { releaseVenueAllocations } from "@/lib/venue-assignment";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export interface CancelRegistrationResult {
  registrationId: string;
  ticketsCancelled: number;
  venueName: string | null;
}

/**
 * Cancels a registration: marks it CANCELLED, cancels all active tickets, and
 * returns seats to whichever venues (and legacy single-venue) it held. Shared
 * by the admin's manual "Cancel Registration" action and the auto-release
 * cron job so both paths behave identically.
 */
export async function cancelRegistration(tx: Tx, registrationId: string): Promise<CancelRegistrationResult> {
  const registration = await tx.registration.findUnique({
    where: { id: registrationId },
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

  await tx.registration.update({
    where: { id: registrationId },
    data: { paymentStatus: PaymentStatus.CANCELLED },
  });

  await tx.ticket.updateMany({
    where: { registrationId, status: TicketStatus.ACTIVE },
    data: { status: TicketStatus.CANCELLED },
  });

  await releaseVenueAllocations(tx, registrationId);
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
}
