// Shared ticket-creation logic — used by the online-payment path, the manual
// finance ledger (full payment reached), and the legacy one-click approve
// flow, so the Adult/Youth typing and sequential numbering only live in one place.
// Kids never get a ticket — there's no KIDS value in the TicketType enum.

function padTicketNumber(n: number): string {
  return `AOG-TKT-${String(n).padStart(5, "0")}`;
}

export async function generateTicketsForRegistration(
  tx: any,
  registrationId: string,
  adults: number,
  youth: number
) {
  if (adults <= 0 && youth <= 0) return [];

  const maxResult = await tx.$queryRaw<{ max: string | null }[]>`
    SELECT MAX(CAST(SUBSTRING("ticketNumber" FROM 9) AS INTEGER)) AS max
    FROM "Ticket"
    WHERE "ticketNumber" LIKE 'AOG-TKT-%'
  `;
  const nextSeq = (Number(maxResult[0]?.max) || 0) + 1;

  const ticketData = [
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

  await tx.ticket.createMany({ data: ticketData });

  return tx.ticket.findMany({
    where: { registrationId },
    orderBy: { ticketNumber: "asc" },
  });
}
