import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export type AudienceType = "adults" | "youth" | "kids";

export interface VenueAllocationPlan {
  venueId: string;
  audienceType: AudienceType;
  count: number;
}

export interface AutoAssignResult {
  allocations: VenueAllocationPlan[];
  warnings: string[];
}

/**
 * Splits a registration's adults/youth/kids counts across venues dedicated to
 * each age group (Venue.audienceType), picking whichever active venue for
 * that type still has room. This is provisional — the client's venues aren't
 * classified yet, so any bucket without a matching/available venue is simply
 * skipped (with a warning) rather than failing the registration. Once venues
 * have an audienceType set via the admin UI, allocation starts happening
 * automatically with no code change needed.
 */
export async function autoAssignVenues(
  tx: Tx,
  eventId: string,
  counts: { adults: number; youth: number; kids: number }
): Promise<AutoAssignResult> {
  const allBuckets: { type: AudienceType; count: number }[] = [
    { type: "adults", count: counts.adults },
    { type: "youth", count: counts.youth },
    { type: "kids", count: counts.kids },
  ];
  const buckets = allBuckets.filter((b) => b.count > 0);

  const allocations: VenueAllocationPlan[] = [];
  const warnings: string[] = [];

  for (const bucket of buckets) {
    const candidates = await tx.venue.findMany({
      where: { eventId, audienceType: bucket.type, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    const venue = candidates.find((v) => v.capacity - v.currentRegistrations >= bucket.count);

    if (!venue) {
      warnings.push(
        candidates.length === 0
          ? `No active venue is configured for "${bucket.type}" yet — ${bucket.count} attendee(s) weren't assigned to a venue.`
          : `No "${bucket.type}" venue currently has room for ${bucket.count} more attendee(s) — not assigned to a venue.`
      );
      continue;
    }

    allocations.push({ venueId: venue.id, audienceType: bucket.type, count: bucket.count });
  }

  return { allocations, warnings };
}

/** Raised when a venue filled up between autoAssignVenues picking it and this commit. */
export class VenueOversoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VenueOversoldError";
  }
}

/**
 * Persists a venue allocation plan: creates VenueAllocation rows and bumps
 * each venue's currentRegistrations.
 *
 * The increment is written as a conditional UPDATE that re-asserts the
 * capacity check inside the same statement. autoAssignVenues already refused
 * venues without room, so for a single booking this changes nothing — but at
 * READ COMMITTED two concurrent bookings can both read the same
 * currentRegistrations and both pass that earlier check. Letting the database
 * arbitrate the last write is what stops a paid, fixed-capacity room (the
 * gala ballroom) from being sold past its seat count.
 */
export async function applyVenueAllocations(
  tx: Tx,
  registrationId: string,
  allocations: VenueAllocationPlan[]
): Promise<void> {
  for (const alloc of allocations) {
    await tx.venueAllocation.create({
      data: {
        registrationId,
        venueId: alloc.venueId,
        audienceType: alloc.audienceType,
        count: alloc.count,
      },
    });

    const updated = await (tx as any).$executeRaw`
      UPDATE "Venue"
      SET "currentRegistrations" = "currentRegistrations" + ${alloc.count}
      WHERE "id" = ${alloc.venueId}
        AND "currentRegistrations" + ${alloc.count} <= "capacity"
    `;

    if (updated === 0) {
      throw new VenueOversoldError(
        `This session filled up while your booking was being processed — ${alloc.count} seat(s) are no longer available.`
      );
    }
  }
}

/** Releases a registration's venue allocations (e.g. on cancellation) and decrements the venues' counts back down. */
export async function releaseVenueAllocations(tx: Tx, registrationId: string): Promise<void> {
  const allocations = await tx.venueAllocation.findMany({ where: { registrationId } });
  for (const alloc of allocations) {
    await tx.venue.update({
      where: { id: alloc.venueId },
      data: { currentRegistrations: { decrement: alloc.count } },
    });
  }
  await tx.venueAllocation.deleteMany({ where: { registrationId } });
}
