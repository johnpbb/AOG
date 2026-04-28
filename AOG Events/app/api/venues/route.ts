import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/venues — list venues (optionally filter by eventId or unassigned)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");
  const unassigned = searchParams.get("unassigned") === "true";

  try {
    const venues = await prisma.venue.findMany({
      where: eventId
        ? { eventId }
        : unassigned
        ? { eventId: null }
        : undefined,
      include: {
        event: { select: { id: true, name: true, slug: true } },
        _count: { select: { registrations: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(venues);
  } catch (error) {
    console.error("GET /api/venues error:", error);
    return NextResponse.json({ error: "Failed to fetch venues" }, { status: 500 });
  }
}

// POST /api/venues — create venue (eventId optional)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, address, city, capacity, eventId, isActive } = body;

    if (!name || !capacity) {
      return NextResponse.json({ error: "Name and capacity are required" }, { status: 400 });
    }

    const venue = await prisma.venue.create({
      data: {
        name,
        description: description || null,
        address: address || null,
        city: city || null,
        capacity: parseInt(capacity),
        isActive: isActive !== undefined ? isActive : true,
        // Only include eventId if provided — Prisma rejects explicit null on create for relations
        ...(eventId ? { eventId } : {}),
      },
    });

    return NextResponse.json(venue, { status: 201 });
  } catch (error) {
    console.error("POST /api/venues error:", error);
    return NextResponse.json({ error: "Failed to create venue" }, { status: 500 });
  }
}
