/**
 * Pure decision layer for bringing an already-issued ticket set in line with
 * an amended headcount. Deliberately free of Prisma and any I/O so the
 * arithmetic that decides which QR codes get invalidated can be reasoned
 * about — and tested — on its own.
 */

/** Message is safe to show an admin verbatim. */
export class AmendError extends Error {}

export interface ReconcilableTicket {
  id: string;
  ticketType: "ADULT" | "YOUTH";
  /** Number of days this ticket has been scanned in at the door. */
  checkIns: number;
}

export interface TicketPlan {
  cancelIds: string[];
  create: { ticketType: "ADULT" | "YOUTH" }[];
  added: number;
  cancelled: number;
}

/**
 * Surplus tickets are cancelled highest-number-first, and a ticket that has
 * already been scanned at the door is never cancelled — a reduction that
 * would require one is rejected, since that person is demonstrably attending
 * and the admin needs to resolve it deliberately rather than have the tool
 * silently void someone's entry.
 *
 * `active` is expected in ascending ticket-number order.
 */
export function planTicketReconciliation(
  active: ReconcilableTicket[],
  targets: { ADULT: number; YOUTH: number }
): TicketPlan {
  const cancelIds: string[] = [];
  const create: { ticketType: "ADULT" | "YOUTH" }[] = [];

  for (const type of ["ADULT", "YOUTH"] as const) {
    const ofType = active.filter((t) => t.ticketType === type);
    const target = targets[type];
    const label = type === "ADULT" ? "adults" : "youth";

    if (target < 0) throw new AmendError("Attendee counts must be zero or more.");

    if (ofType.length > target) {
      const surplus = ofType.length - target;
      const cancellable = ofType.filter((t) => t.checkIns === 0);
      if (cancellable.length < surplus) {
        const checkedIn = ofType.length - cancellable.length;
        throw new AmendError(
          `Can't reduce ${label} to ${target} — ${checkedIn} of the ${ofType.length} ${label} ticket(s) have already been checked in at the event.`
        );
      }
      cancelIds.push(...cancellable.slice(-surplus).map((t) => t.id));
    } else if (ofType.length < target) {
      const deficit = target - ofType.length;
      for (let i = 0; i < deficit; i++) create.push({ ticketType: type });
    }
  }

  return { cancelIds, create, added: create.length, cancelled: cancelIds.length };
}
