import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/churches?q=&country= — search the preloaded official church list.
// Churches are NOT locked to a category here; `category` is HQ-reported data
// used only to pre-fill the category step — the registrant can always pick a
// different category, which is then validated against attendee counts.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const country = searchParams.get("country")?.trim();

  const churches = await prisma.church.findMany({
    where: {
      isActive: true,
      ...(country ? { country } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true, district: true, country: true, category: true },
    orderBy: { name: "asc" },
    take: 20,
  });

  return NextResponse.json({ churches });
}
