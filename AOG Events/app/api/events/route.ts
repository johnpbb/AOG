import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/events — public list of published events (+ admin all)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true"; // admin mode

  try {
    const events = await prisma.event.findMany({
      where: all ? undefined : { status: "PUBLISHED" },
      include: {
        venues: {
          select: { id: true, name: true, city: true, capacity: true, currentRegistrations: true },
        },
        _count: { select: { registrations: true } },
      },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

// POST /api/events — create a new event (admin)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      description,
      shortDesc,
      startDate,
      endDate,
      status,
      bannerUrl,
      location,
      slug,
      scheduleTable,
    } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    const event = await prisma.event.create({
      data: {
        name,
        description: description || null,
        shortDesc: shortDesc || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: status || "DRAFT",
        bannerUrl: bannerUrl || null,
        location: location || null,
        slug,
        scheduleTable: scheduleTable || null,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    console.error("POST /api/events error:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
