import type { Prisma } from "@prisma/client";
import { REGISTRATION_CATEGORIES } from "@/lib/types";
import { checkCategoryCapacity, RegistrationCapacityError } from "@/lib/create-registration";
import { autoAssignVenues, applyVenueAllocations, releaseVenueAllocations } from "@/lib/venue-assignment";
import { createTickets } from "@/lib/tickets";
import { planTicketReconciliation, AmendError } from "@/lib/ticket-reconciliation";

export { AmendError };

/**
 * Admin-side post-payment amendment of a registration's headcount and named
 * attendee list — the thing the public self-amend flow deliberately refuses
 * to do (app/api/register/amend locks headcounts once payment is COMPLETED).
 *
 * The hard part isn't the counts, it's that tickets already exist by then.
 * Rather than tearing the ticket set down and reissuing it — which would
 * invalidate QR codes the church has already been emailed and printed — this
 * reconciles in place: it cancels only the surplus, mints only the shortfall,
 * and re-points attendee names at the tickets that were already there.
 */

export interface AmendAttendeeInput {
  firstName: string;
  lastName: string;
  ageCategory: "ADULT" | "YOUTH";
  email?: string | null;
  phone?: string | null;
}

export interface AmendRegistrationInput {
  adults?: number;
  youth?: number;
  kids?: number;
  /**
   * When present, replaces the named-attendee list wholesale and must match
   * the resulting adult/youth headcounts exactly. When absent, existing
   * names are left alone.
   */
  attendees?: AmendAttendeeInput[] | null;
  /** Free-text reason, recorded in the amendment trail. */
  note?: string | null;
}

export interface AmendRegistrationResult {
  registrationId: string;
  before: { adults: number; youth: number; kids: number; fee: number };
  after: { adults: number; youth: number; kids: number; fee: number };
  ticketsAdded: number;
  ticketsCancelled: number;
  attendeesNamed: number;
  ticketsIssued: boolean;
}

function toCount(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n) || n < 0) throw new AmendError("Attendee counts must be whole numbers of zero or more.");
  return n;
}

/** Applies planTicketReconciliation's decision to the database. */
async function reconcileTickets(
  tx: Prisma.TransactionClient,
  registrationId: string,
  targets: { ADULT: number; YOUTH: number }
): Promise<{ added: number; cancelled: number }> {
  const active = await tx.ticket.findMany({
    where: { registrationId, status: "ACTIVE" },
    include: { _count: { select: { dailyCheckIns: true } } },
    orderBy: { ticketNumber: "asc" },
  });

  const plan = planTicketReconciliation(
    active.map((t) => ({ id: t.id, ticketType: t.ticketType, checkIns: t._count.dailyCheckIns })),
    targets
  );

  if (plan.cancelIds.length > 0) {
    await tx.ticket.updateMany({
      where: { id: { in: plan.cancelIds } },
      // attendeeId is cleared too: it's a unique column, so leaving a
      // cancelled ticket holding a name would block re-linking that person
      // to a live ticket later.
      data: { status: "CANCELLED", attendeeId: null },
    });
  }

  await createTickets(tx, registrationId, plan.create);

  return { added: plan.added, cancelled: plan.cancelled };
}

/** Replaces the attendee rows and re-points each one at an ACTIVE ticket of the matching type. */
async function replaceAttendees(
  tx: Prisma.TransactionClient,
  registrationId: string,
  attendees: AmendAttendeeInput[]
): Promise<number> {
  // Deleting clears Ticket.attendeeId via the schema's onDelete: SetNull, so
  // the tickets themselves (and their QR codes) survive the swap untouched.
  await tx.attendee.deleteMany({ where: { registrationId } });

  for (const a of attendees) {
    await tx.attendee.create({
      data: {
        registrationId,
        firstName: a.firstName,
        lastName: a.lastName,
        email: a.email || null,
        phone: a.phone || null,
        ageCategory: a.ageCategory,
      },
    });
  }

  const created = await tx.attendee.findMany({
    where: { registrationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, ageCategory: true },
  });

  const tickets = await tx.ticket.findMany({
    where: { registrationId, status: "ACTIVE" },
    orderBy: { ticketNumber: "asc" },
    select: { id: true, ticketType: true },
  });

  let linked = 0;
  for (const type of ["ADULT", "YOUTH"] as const) {
    const people = created.filter((a) => a.ageCategory === type);
    const seats = tickets.filter((t) => t.ticketType === type);
    for (let i = 0; i < Math.min(people.length, seats.length); i++) {
      await tx.ticket.update({ where: { id: seats[i].id }, data: { attendeeId: people[i].id } });
      linked++;
    }
  }

  return linked;
}

export async function amendRegistration(
  tx: Prisma.TransactionClient,
  id: string,
  input: AmendRegistrationInput,
  actor: { id: string; name: string } | null
): Promise<AmendRegistrationResult> {
  const registration = await tx.registration.findUnique({
    where: { id },
    include: {
      tickets: { select: { id: true, status: true } },
      attendees: { select: { id: true, ageCategory: true } },
    },
  });

  if (!registration) throw new AmendError("NOT_FOUND");
  if (registration.paymentStatus === "CANCELLED") {
    throw new AmendError("This registration has been cancelled and can no longer be amended.");
  }

  const adults = toCount(input.adults, registration.adults);
  const youth = toCount(input.youth, registration.youth);
  const kids = toCount(input.kids, registration.kids);
  const total = adults + youth + kids;

  if (total <= 0) throw new AmendError("A registration must have at least one attendee.");

  const attendees = input.attendees ?? null;
  if (attendees) {
    const namedAdults = attendees.filter((a) => a.ageCategory === "ADULT").length;
    const namedYouth = attendees.filter((a) => a.ageCategory === "YOUTH").length;
    if (namedAdults !== adults || namedYouth !== youth) {
      throw new AmendError(
        `The attendee list doesn't match the headcount — it names ${namedAdults} adult(s) and ${namedYouth} youth, but the registration is set to ${adults} adult(s) and ${youth} youth. Kids are counted only and must not appear in the list.`
      );
    }
  } else {
    // No new list supplied: don't silently strand existing names on tickets
    // that are about to be cancelled.
    const existingAdults = registration.attendees.filter((a) => a.ageCategory === "ADULT").length;
    const existingYouth = registration.attendees.filter((a) => a.ageCategory === "YOUTH").length;
    if (existingAdults > adults || existingYouth > youth) {
      throw new AmendError(
        `This registration already names ${existingAdults} adult(s) and ${existingYouth} youth. To reduce the headcount below that, upload a replacement attendee list matching the new numbers.`
      );
    }
  }

  const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === registration.category);
  if (catInfo) {
    try {
      await checkCategoryCapacity(tx, catInfo, { adults, youth, kids }, registration.id);
    } catch (err) {
      if (err instanceof RegistrationCapacityError) throw new AmendError(err.message);
      throw err;
    }
  }

  // Re-split across venues from scratch for the new counts (same approach as
  // the public amend): a shrink in one bucket can free the room a growth in
  // another needs, so patching per-venue deltas would miss valid outcomes.
  await releaseVenueAllocations(tx, registration.id);
  const { allocations, warnings } = await autoAssignVenues(tx, registration.eventId, { adults, youth, kids });
  if (warnings.length > 0) {
    // Throwing rolls the release back with the rest of the transaction, so
    // the registration keeps the allocation it already had.
    throw new AmendError(`Venue capacity can't absorb this change:\n${warnings.join("\n")}`);
  }
  await applyVenueAllocations(tx, registration.id, allocations);

  // Tickets only exist once payment completed; before that there's nothing to
  // reconcile and they'll be minted from the final counts/names at approval.
  // Keyed off payment status rather than "has any live ticket" so a
  // registration an earlier amendment emptied out still gets a fresh set
  // issued when its headcount goes back up.
  const ticketsIssued =
    registration.paymentStatus === "COMPLETED" || registration.tickets.some((t) => t.status === "ACTIVE");
  let ticketsAdded = 0;
  let ticketsCancelled = 0;
  if (ticketsIssued) {
    const result = await reconcileTickets(tx, registration.id, { ADULT: adults, YOUTH: youth });
    ticketsAdded = result.added;
    ticketsCancelled = result.cancelled;
  }

  let attendeesNamed = registration.attendees.length;
  if (attendees) {
    attendeesNamed = await replaceAttendees(tx, registration.id, attendees);
  }

  // Church fees are flat per category, so only individual/overseas fees move
  // with the headcount.
  const fee =
    registration.type === "INDIVIDUAL" && catInfo ? catInfo.fee * total : registration.fee;

  // No audit-log table exists, and Payment is a finance-only append-only
  // ledger that an attendee change has no business writing to — so the trail
  // lives alongside the registration's own data in formData.
  const formData = (registration.formData ?? {}) as Record<string, unknown>;
  const amendments = Array.isArray(formData.amendments) ? formData.amendments : [];
  amendments.push({
    at: new Date().toISOString(),
    by: actor?.name ?? "Unknown admin",
    byId: actor?.id ?? null,
    from: { adults: registration.adults, youth: registration.youth, kids: registration.kids, fee: registration.fee },
    to: { adults, youth, kids, fee },
    ticketsAdded,
    ticketsCancelled,
    attendeesReplaced: !!attendees,
    note: input.note || null,
  });

  await tx.registration.update({
    where: { id: registration.id },
    data: {
      adults,
      youth,
      kids,
      numberOfAttendees: total,
      fee,
      formData: { ...formData, amendments } as Prisma.InputJsonValue,
    },
  });

  return {
    registrationId: registration.registrationId,
    before: { adults: registration.adults, youth: registration.youth, kids: registration.kids, fee: registration.fee },
    after: { adults, youth, kids, fee },
    ticketsAdded,
    ticketsCancelled,
    attendeesNamed,
    ticketsIssued,
  };
}
