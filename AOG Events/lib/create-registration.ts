import { REGISTRATION_CATEGORIES, INSTALLMENT_DEADLINE, CategoryInfo } from "@/lib/types";
import { autoAssignVenues, applyVenueAllocations } from "@/lib/venue-assignment";
import type { Prisma } from "@prisma/client";

// Builds the spec's reference number: AG100-{3-digit churchId}{categoryCode}{total}.
// Non-church registrations (no real Church match) use "000" as the church-ID block.
// If the exact combination already exists (e.g. same church re-registers at the
// same headcount), a numeric suffix is appended to keep the ID unique.
async function generateRegistrationId(
  tx: Prisma.TransactionClient,
  churchId: string | null,
  categoryCode: string,
  total: number
): Promise<string> {
  const base = `AG100-${churchId ?? "000"}${categoryCode}${total}`;
  let candidate = base;
  let suffix = 2;
  while (await tx.registration.findUnique({ where: { registrationId: candidate } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export interface CreateRegistrationInput {
  category: string;
  type: "church" | "individual" | string;
  email: string;
  phone?: string | null;
  churchId?: string | null;
  registrarName?: string | null;
  contactPreference?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  eventId: string;
  paymentMethod: string;
  fee: number;
  numberOfTickets?: number;
  adults?: number;
  youth?: number;
  kids?: number;
  paymentType?: string;
  installmentCount?: number;
  attendees?: { firstName: string; lastName: string; email?: string; phone?: string }[];
  formData?: Record<string, unknown>;
}

export class RegistrationCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistrationCapacityError";
  }
}

// Reused for "not a real capacity problem, but still not safe to proceed"
// cases (currently: unrecognized category) — same shape/handling as a
// capacity error at both call sites (safe .message, 409 status).
export class RegistrationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistrationValidationError";
  }
}

export interface HeadcountInput {
  adults: number;
  youth: number;
  kids: number;
}

/**
 * Category capacity check, shared by initial registration and amendment so
 * the two rules can't drift apart. Two independent capping strategies:
 *  - perRegCap: a static max per single registration (church tiers) — the
 *    real ceiling on total attendance is venue capacity, not an aggregate
 *    pool, since any number of churches may register within a size bracket.
 *  - pool: an aggregate cap shared across every registration in the category
 *    (Individual, Overseas Delegates), checked as three independent
 *    adults/youth/kids sub-pools.
 * `excludeRegistrationId` lets an amendment compare its new totals against
 * the pool with its own prior reservation left out, instead of a delta.
 */
export async function checkCategoryCapacity(
  tx: Prisma.TransactionClient,
  catInfo: CategoryInfo,
  counts: HeadcountInput,
  excludeRegistrationId?: string
): Promise<void> {
  if (catInfo.perRegCap) {
    const { adults, youth, kids } = catInfo.perRegCap;
    if (counts.adults > adults || counts.youth > youth || counts.kids > kids) {
      throw new RegistrationCapacityError(
        `This exceeds the per-registration limit for ${catInfo.name} (max ${adults} adults, ${youth} youth, ${kids} kids).`
      );
    }
    return;
  }

  if (catInfo.pool) {
    const activeRegs = await tx.registration.findMany({
      where: {
        category: catInfo.id,
        paymentStatus: { not: "CANCELLED" },
        ...(excludeRegistrationId ? { id: { not: excludeRegistrationId } } : {}),
      },
      select: { adults: true, youth: true, kids: true },
    });
    const used = activeRegs.reduce(
      (acc, r) => ({ adults: acc.adults + r.adults, youth: acc.youth + r.youth, kids: acc.kids + r.kids }),
      { adults: 0, youth: 0, kids: 0 }
    );
    const remaining = {
      adults: catInfo.pool.adults - used.adults,
      youth: catInfo.pool.youth - used.youth,
      kids: catInfo.pool.kids - used.kids,
    };
    if (counts.adults > remaining.adults || counts.youth > remaining.youth || counts.kids > remaining.kids) {
      throw new RegistrationCapacityError(
        `Only ${Math.max(0, remaining.adults)} adult / ${Math.max(0, remaining.youth)} youth / ${Math.max(0, remaining.kids)} kids seat(s) remain in the ${catInfo.name} pool.`
      );
    }
  }
}

/**
 * The single source of truth for creating a Registration: pool-capacity
 * check, reference-number generation, the row itself, and venue
 * auto-assignment. Shared by the public registration form (app/api/register)
 * and the admin CSV bulk-import commit path, so both get the same capacity
 * guarantees instead of two copies drifting apart.
 *
 * Must be called inside a prisma.$transaction — throws RegistrationCapacityError
 * (safe to show the message directly to a user) on a capacity/limit conflict.
 *
 * `input.fee` is intentionally ignored — the fee is always derived here from
 * the category (and ticket count, for individual registrations), never
 * trusted from the caller. The CSV import commit endpoint accepts
 * client-echoed row data, and even the public form's `fee` field is
 * client-supplied at the HTTP boundary, so trusting it directly would let a
 * tampered request register for an arbitrary (e.g. zero) amount.
 */
export async function createRegistrationRecord(tx: Prisma.TransactionClient, input: CreateRegistrationInput) {
  const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === input.category);
  if (!catInfo) {
    throw new RegistrationValidationError(`"${input.category}" is not a recognized registration category.`);
  }

  const isChurchPath = (input.type || "").toLowerCase() === "church";
  const numAdults = Math.max(0, input.adults ?? 0);
  const numYouth = Math.max(0, input.youth ?? 0);
  const numKids = Math.max(0, input.kids ?? 0);
  const qty = numAdults + numYouth + numKids;
  if (qty <= 0) {
    throw new RegistrationValidationError("At least one attendee is required.");
  }
  // Kids don't receive a ticket/QR code — only adults and youth do.
  const ticketQty = numAdults + numYouth;
  // Church fee is flat per registration regardless of headcount within its
  // cap; individual/overseas fee scales per attendee.
  const fee = isChurchPath ? catInfo.fee : catInfo.fee * qty;

  await checkCategoryCapacity(tx, catInfo, { adults: numAdults, youth: numYouth, kids: numKids });

  // Venue capacity is the true ceiling on total attendance (each cell
  // auto-locks when full — no manual override without going through the
  // admin's separate manual-registration/CSV-import tools). Check this
  // before creating anything so a full venue rejects outright rather than
  // silently succeeding without a venue slot.
  const { allocations, warnings: venueWarnings } = await autoAssignVenues(tx, input.eventId, {
    adults: numAdults,
    youth: numYouth,
    kids: numKids,
  });
  if (venueWarnings.length > 0) {
    throw new RegistrationCapacityError(
      "This session is full. Please try a different registration or contact the event team."
    );
  }

  const registrationId = await generateRegistrationId(tx, input.churchId || null, catInfo.categoryCode, qty);

  const registration = await tx.registration.create({
    data: {
      registrationId,
      category: catInfo.id,
      type: (input.type || "individual").toUpperCase() as "CHURCH" | "INDIVIDUAL",
      churchId: input.churchId || null,
      email: input.email || "unknown",
      phone: input.phone || null,
      registrarName: input.registrarName || null,
      contactPreference: input.contactPreference || null,
      contactPhone: input.contactPhone || null,
      contactEmail: input.contactEmail || null,
      eventId: input.eventId,
      fee,
      paymentMethod:
        input.paymentMethod === "mpaisa" ? "MPAISA"
        : input.paymentMethod === "world-remit" ? "WORLD_REMIT"
        : input.paymentMethod === "online" ? "ONLINE"
        : "BANK_TRANSFER",
      paymentStatus: "PENDING",
      formData: (input.formData || {}) as Prisma.InputJsonValue,
      numberOfAttendees: qty,
      adults: numAdults,
      youth: numYouth,
      kids: numKids,
      paymentType: input.paymentType === "partial" ? "partial" : "full",
      installmentCount: input.paymentType === "partial" ? Math.min(10, Math.max(2, input.installmentCount || 5)) : null,
      installmentDeadline: input.paymentType === "partial" ? INSTALLMENT_DEADLINE : null,
      ...(input.attendees && input.attendees.length > 0
        ? {
            attendees: {
              create: input.attendees.map((a) => ({
                firstName: a.firstName,
                lastName: a.lastName,
                email: a.email || null,
                phone: a.phone || null,
              })),
            },
          }
        : {}),
    },
  });

  await applyVenueAllocations(tx, registration.id, allocations);

  return { registration, catInfo, qty, venueWarnings };
}
