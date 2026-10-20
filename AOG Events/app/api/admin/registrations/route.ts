import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const registrations = await prisma.registration.findMany({
      include: {
        attendees: true,
        venue: { select: { id: true, name: true } },
        venueAllocations: { include: { venue: { select: { id: true, name: true } } } },
        tickets: { select: { id: true, ticketNumber: true, status: true } },
        payments: { select: { id: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(registrations);
  } catch (error: any) {
    console.error("Fetch Registrations Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
