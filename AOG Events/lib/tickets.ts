// Shared ticket-creation logic — used by the online-payment path, the manual
// finance ledger (full payment reached), and the legacy one-click approve
// flow, so the Adult/Youth typing and sequential numbering only live in one place.
// Kids never get a ticket — there's no KIDS value in the TicketType enum.

function padTicketNumber(n: number): string {
  return `AOG-TKT-${String(n).padStart(5, "0")}`;
}

interface NamedAttendee {
  id: string;
  ageCategory: "ADULT" | "YOUTH";
}

/**
 * One ticket per attendee, linked via attendeeId, when the registration has
 * named attendees (public church CSV upload / individual name fields).
 * Falls back to bare nameless tickets from `adults`/`youth` counts when it
 * doesn't — admin bulk-CSV-imported and any pre-existing registrations have
 * no per-person names.
 */
export async function generateTicketsForRegistration(
  tx: any,
  registrationId: string,
  adults: number,
  youth: number,
  attendees: NamedAttendee[] = []
) {
  if (adults <= 0 && youth <= 0) return [];

  const maxResult = await tx.$queryRaw<{ max: string | null }[]>`
    SELECT MAX(CAST(SUBSTRING("ticketNumber" FROM 9) AS INTEGER)) AS max
    FROM "Ticket"
    WHERE "ticketNumber" LIKE 'AOG-TKT-%'
  `;
  const nextSeq = (Number(maxResult[0]?.max) || 0) + 1;

  let ticketData: { ticketNumber: string; registrationId: string; status: "ACTIVE"; ticketType: "ADULT" | "YOUTH"; attendeeId?: string }[];

  if (attendees.length > 0) {
    const adultAttendees = attendees.filter((a) => a.ageCategory === "ADULT");
    const youthAttendees = attendees.filter((a) => a.ageCategory === "YOUTH");
    const ordered = [...adultAttendees, ...youthAttendees];
    ticketData = ordered.map((a, i) => ({
      ticketNumber: padTicketNumber(nextSeq + i),
      registrationId,
      status: "ACTIVE" as const,
      ticketType: a.ageCategory,
      attendeeId: a.id,
    }));
  } else {
    ticketData = [
      ...Array.from({ length: adults }, (_, i) => ({
        ticketNumber: padTicketNumber(nextSeq + i),
        registrationId,
        status: "ACTIVE" as const,
        ticketType: "ADULT" as const,
      })),
      ...Array.from({ length: youth }, (_, i) => ({
        ticketNumber: padTicketNumber(nextSeq + adults + i),
        registrationId,
        status: "ACTIVE" as const,
        ticketType: "YOUTH" as const,
      })),
    ];
  }

  await tx.ticket.createMany({ data: ticketData });

  return tx.ticket.findMany({
    where: { registrationId },
    include: { attendee: { select: { firstName: true, lastName: true } } },
    orderBy: { ticketNumber: "asc" },
  });
}

// Maps each ticket to the venue its ticket type (Adult/Youth) was allocated
// to for this registration, via VenueAllocation — used to print the venue on
// each ticket and color-code by type. Kids never appear here (no ticket).
export function attachVenuesToTickets<T extends { ticketType: "ADULT" | "YOUTH" }>(
  tickets: T[],
  venueAllocations: { audienceType: string; venue: { name: string; city: string | null } | null }[]
): (T & { venueName: string; venueCity: string })[] {
  const byAudience = new Map(venueAllocations.map((a) => [a.audienceType, a.venue]));
  return tickets.map((t) => {
    const venue = byAudience.get(t.ticketType === "ADULT" ? "adults" : "youth");
    return { ...t, venueName: venue?.name ?? "", venueCity: venue?.city ?? "" };
  });
}

// A short summary string for the email body (e.g. "Mount Zion Cathedral,
// Churchill Park") when a registration's tickets span more than one venue.
export function summarizeTicketVenues(tickets: { venueName: string }[]): string {
  return Array.from(new Set(tickets.map((t) => t.venueName).filter(Boolean))).join(", ");
}

// A friendly registration-type label for the ticket — coarser than the raw
// `type` enum, since Overseas Delegates are technically type=INDIVIDUAL but
// warrant their own label on the ticket.
export function deriveRegistrationTypeLabel(type: string, category: string): string {
  if ((type || "").toUpperCase() === "CHURCH") return "Church";
  if (category === "overseas-delegates") return "Overseas Delegate";
  return "Individual";
}

export function formatPaymentStatusLabel(fee: number, totalPaid: number): string {
  const balance = fee - totalPaid;
  if (balance <= 0.01) return "PAID IN FULL";
  return `PARTIAL – Balance $${balance.toFixed(2)} owing`;
}
