import type { Prisma } from "@prisma/client";
import { PaymentStatus } from "@prisma/client";
import { REGISTRATION_CATEGORIES } from "@/lib/types";
import { autoAssignVenues, applyVenueAllocations } from "@/lib/venue-assignment";
import {
  checkCategoryCapacity,
  RegistrationCapacityError,
  RegistrationValidationError,
} from "@/lib/create-registration";

export interface ReactivateRegistrationResult {
  registrationId: string;
  reactivatedAt: Date;
}

/**
 * Reverses cancelRegistration for a registration that expired (or was
 * cancelled by mistake) before it was paid: puts it back to PENDING, re-checks
 * the category cap, re-books venue seats, and starts a fresh expiry window.
 *
 * Cancelling returned the seats to the pool, so this re-claims them and fails
 * with RegistrationCapacityError if someone else has taken them since — it
 * never forces a registration past a cap. Registrations that carry payments
 * or tickets are refused (RegistrationValidationError): those weren't
 * auto-expired and need a person to decide what their status should be.
 *
 * Must run inside prisma.$transaction.
 */
export async function reactivateRegistration(
  tx: Prisma.TransactionClient,
  registrationId: string
): Promise<ReactivateRegistrationResult> {
  const registration = await tx.registration.findUnique({
    where: { id: registrationId },
    include: { payments: { select: { id: true } }, tickets: { select: { id: true } } },
  });

  if (!registration) throw new Error("NOT_FOUND");
  if (registration.paymentStatus !== PaymentStatus.CANCELLED) throw new Error("NOT_CANCELLED");

  if (registration.payments.length > 0 || registration.tickets.length > 0) {
    throw new RegistrationValidationError(
      `${registration.registrationId} has payments or tickets on record, so it needs manual review.`
    );
  }

  const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === registration.category);
  if (!catInfo) {
    throw new RegistrationValidationError(`"${registration.category}" is not a recognized registration category.`);
  }

  const counts = { adults: registration.adults, youth: registration.youth, kids: registration.kids };

  // The registration is CANCELLED, so it's already excluded from pool usage.
  await checkCategoryCapacity(tx, catInfo, counts, registration.id);

  const { allocations, warnings } = await autoAssignVenues(tx, registration.eventId, counts);
  if (warnings.length > 0) {
    throw new RegistrationCapacityError(`${registration.registrationId}: ${warnings.join(" ")}`);
  }
  await applyVenueAllocations(tx, registration.id, allocations);

  const reactivatedAt = new Date();
  await tx.registration.update({
    where: { id: registration.id },
    data: { paymentStatus: PaymentStatus.PENDING, reactivatedAt, expiryReminderSentAt: null },
  });

  return { registrationId: registration.registrationId, reactivatedAt };
}
