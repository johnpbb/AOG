import { REGISTRATION_CATEGORIES, INSTALLMENT_DEADLINE } from "@/lib/types";
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

/**
 * The single source of truth for creating a Registration: pool-capacity
 * check, reference-number generation, the row itself, and venue
 * auto-assignment. Shared by the public registration form (app/api/register)
 * and the admin CSV bulk-import commit path, so both get the same capacity
 * guarantees instead of two copies drifting apart.
 *
 * Must be called inside a prisma.$transaction — throws RegistrationCapacityError
 * (safe to show the message directly to a user) on a capacity/limit conflict.
 */
export async function createRegistrationRecord(tx: Prisma.TransactionClient, input: CreateRegistrationInput) {
  const isChurchPath = (input.type || "").toLowerCase() === "church";
  const numAdults = isChurchPath ? Math.max(0, input.adults ?? 0) : 0;
  const numYouth = isChurchPath ? Math.max(0, input.youth ?? 0) : 0;
  const numKids = isChurchPath ? Math.max(0, input.kids ?? 0) : 0;
  const qty = isChurchPath ? numAdults + numYouth + numKids : Math.max(1, input.numberOfTickets ?? 1);
  // Kids don't receive a ticket/QR code — only adults and youth do.
  const ticketQty = isChurchPath ? numAdults + numYouth : qty;
  const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === input.category);

  if (catInfo?.registrationLimit !== null && catInfo?.registrationLimit !== undefined) {
    const regCount = await tx.registration.count({
      where: { category: input.category, paymentStatus: "COMPLETED" },
    });
    if (regCount >= catInfo.registrationLimit) {
      throw new RegistrationCapacityError(
        `All ${catInfo.registrationLimit} registrations for ${catInfo.name} have been received.`
      );
    }
  }

  if (catInfo) {
    // Seats are reserved against the pool the moment a registration is
    // submitted (even while payment is pending) — entry QR tickets
    // themselves aren't generated until the registration is fully paid
    // (see lib/tickets.ts), so we can't count Ticket rows here.
    const activeRegs = await tx.registration.findMany({
      where: { category: input.category, paymentStatus: { not: "CANCELLED" } },
      select: { type: true, adults: true, youth: true, numberOfAttendees: true },
    });
    const reservedSeats = activeRegs.reduce(
      (sum, r) => sum + (r.type === "CHURCH" ? r.adults + r.youth : r.numberOfAttendees),
      0
    );
    const remaining = catInfo.ticketPool - reservedSeats;
    if (ticketQty > remaining) {
      throw new RegistrationCapacityError(
        `Only ${remaining} seats remain in the ${catInfo.name} pool. You requested ${ticketQty}.`
      );
    }
  }

  const registrationId = await generateRegistrationId(tx, input.churchId || null, catInfo?.categoryCode ?? "XX", qty);

  const registration = await tx.registration.create({
    data: {
      registrationId,
      category: input.category || "unknown",
      type: (input.type || "individual").toUpperCase() as "CHURCH" | "INDIVIDUAL",
      churchId: input.churchId || null,
      email: input.email || "unknown",
      phone: input.phone || null,
      registrarName: input.registrarName || null,
      contactPreference: input.contactPreference || null,
      contactPhone: input.contactPhone || null,
      contactEmail: input.contactEmail || null,
      eventId: input.eventId,
      fee: input.fee || 0,
      paymentMethod: input.paymentMethod === "online" ? "ONLINE" : "BANK_TRANSFER",
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

  // Split adults/youth/kids across whichever venues are dedicated to each
  // age group and still have room. Provisional — a bucket without a
  // matching/available venue is simply skipped rather than blocking the
  // registration (see lib/venue-assignment.ts).
  const { allocations, warnings: venueWarnings } = await autoAssignVenues(tx, input.eventId, {
    adults: numAdults,
    youth: numYouth,
    kids: numKids,
  });
  await applyVenueAllocations(tx, registration.id, allocations);

  return { registration, catInfo, qty, venueWarnings };
}
