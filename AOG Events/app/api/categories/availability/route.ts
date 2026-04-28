import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { REGISTRATION_CATEGORIES } from "@/lib/types";

// GET /api/categories/availability
// Returns live registration counts and ticket pool usage per category
export async function GET() {
  try {
    const [regCounts, ticketCounts] = await Promise.all([
      // Registration counts per category
      prisma.registration.groupBy({
        by: ["category"],
        _count: { id: true },
        where: { paymentStatus: "COMPLETED" },
      }),
      // Tickets issued per category (join via registration)
      prisma.ticket.groupBy({
        by: ["registrationId"],
        _count: { id: true },
        where: { status: "ACTIVE" },
      }),
    ]);

    // Build a map: registrationId → ticket count
    const ticketsPerReg = new Map(
      ticketCounts.map((t) => [t.registrationId, t._count.id])
    );

    // To get tickets per category, fetch registrations and sum
    const registrations = await prisma.registration.findMany({
      where: { paymentStatus: "COMPLETED" },
      select: { id: true, category: true },
    });

    const ticketsByCategory = new Map<string, number>();
    for (const reg of registrations) {
      const count = ticketsPerReg.get(reg.id) ?? 0;
      ticketsByCategory.set(reg.category, (ticketsByCategory.get(reg.category) ?? 0) + count);
    }

    const regCountMap = new Map(regCounts.map((r) => [r.category, r._count.id]));

    const availability = REGISTRATION_CATEGORIES.map((cat) => {
      const registrationCount = regCountMap.get(cat.id) ?? 0;
      const ticketsClaimed = ticketsByCategory.get(cat.id) ?? 0;
      const poolRemaining = Math.max(0, cat.ticketPool - ticketsClaimed);
      const registrationsRemaining =
        cat.registrationLimit !== null
          ? Math.max(0, cat.registrationLimit - registrationCount)
          : null;

      const isRegFull =
        cat.registrationLimit !== null && registrationCount >= cat.registrationLimit;
      const isPoolFull = ticketsClaimed >= cat.ticketPool;
      const isOpen = !isRegFull && !isPoolFull;

      return {
        id: cat.id,
        registrationCount,
        registrationLimit: cat.registrationLimit,
        registrationsRemaining,
        ticketsClaimed,
        ticketPool: cat.ticketPool,
        poolRemaining,
        // Dynamic max for the stepper: min(maxTicketsPerReg, poolRemaining)
        stepperMax: Math.min(cat.maxTicketsPerReg, poolRemaining),
        isRegFull,
        isPoolFull,
        isOpen,
        closedReason: isRegFull
          ? `All ${cat.registrationLimit} registrations for this category have been received`
          : isPoolFull
          ? `All ${cat.ticketPool} tickets for this category have been allocated`
          : null,
      };
    });

    return NextResponse.json({ availability });
  } catch (error: any) {
    console.error("Availability error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
