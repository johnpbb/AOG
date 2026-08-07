import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { REGISTRATION_CATEGORIES } from "@/lib/types";

// GET /api/categories/availability
// Returns live per-type (adults/youth/kids) stepper maxima and open/closed
// status per category. Deliberately doesn't surface which venue or bucket
// is behind a "closed" state — registrants only see that a cap exists.
export async function GET() {
  try {
    const activeRegs = await prisma.registration.findMany({
      where: { paymentStatus: { not: "CANCELLED" } },
      select: { category: true, adults: true, youth: true, kids: true },
    });

    const usedByCategory = new Map<string, { adults: number; youth: number; kids: number }>();
    for (const reg of activeRegs) {
      const acc = usedByCategory.get(reg.category) ?? { adults: 0, youth: 0, kids: 0 };
      acc.adults += reg.adults;
      acc.youth += reg.youth;
      acc.kids += reg.kids;
      usedByCategory.set(reg.category, acc);
    }

    const availability = REGISTRATION_CATEGORIES.map((cat) => {
      if (cat.perRegCap) {
        // Ceiling is venue capacity, not an aggregate pool — a per-registration
        // cap is always "open" from the category's own point of view.
        return {
          id: cat.id,
          stepperMaxAdults: cat.perRegCap.adults,
          stepperMaxYouth: cat.perRegCap.youth,
          stepperMaxKids: cat.perRegCap.kids,
          isOpen: true,
          closedReason: null,
        };
      }

      const used = usedByCategory.get(cat.id) ?? { adults: 0, youth: 0, kids: 0 };
      const remaining = {
        adults: Math.max(0, (cat.pool?.adults ?? 0) - used.adults),
        youth: Math.max(0, (cat.pool?.youth ?? 0) - used.youth),
        kids: Math.max(0, (cat.pool?.kids ?? 0) - used.kids),
      };
      const isOpen = remaining.adults > 0 || remaining.youth > 0 || remaining.kids > 0;

      return {
        id: cat.id,
        stepperMaxAdults: remaining.adults,
        stepperMaxYouth: remaining.youth,
        stepperMaxKids: remaining.kids,
        isOpen,
        closedReason: isOpen ? null : `All spots for ${cat.name} have been allocated`,
      };
    });

    return NextResponse.json({ availability });
  } catch (error: any) {
    console.error("Availability error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
