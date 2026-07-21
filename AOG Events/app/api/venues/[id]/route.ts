import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/venues/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const venue = await prisma.venue.findUnique({
      where: { id },
      include: {
        event: { select: { id: true, name: true, slug: true } },
        _count: { select: { registrations: true } },
      },
    });

    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    return NextResponse.json(venue);
  } catch (error) {
    console.error("GET /api/venues/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch venue" }, { status: 500 });
  }
}

// PUT /api/venues/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { name, description, address, city, capacity, isActive, eventId, audienceType } = body;

    const venue = await prisma.venue.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(capacity !== undefined && { capacity: parseInt(capacity) }),
        ...(isActive !== undefined && { isActive }),
        // audienceType can be set to a string (assign) or null (unassign)
        ...("audienceType" in body && { audienceType: audienceType || null }),
        // eventId can be set to a string (assign) or null (unassign)
        ...("eventId" in body && { eventId: eventId ?? null }),
      },
    });

    return NextResponse.json(venue);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }
    console.error("PUT /api/venues/[id] error:", error);
    return NextResponse.json({ error: "Failed to update venue" }, { status: 500 });
  }
}


// DELETE /api/venues/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const registrationCount = await prisma.registration.count({ where: { venueId: id } });
    if (registrationCount > 0) {
      return NextResponse.json(
        {
          error: `This venue has ${registrationCount} linked registration${registrationCount === 1 ? "" : "s"} and can't be deleted. Deactivate it instead.`,
        },
        { status: 409 }
      );
    }

    await prisma.venue.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }
    console.error("DELETE /api/venues/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete venue" }, { status: 500 });
  }
}
