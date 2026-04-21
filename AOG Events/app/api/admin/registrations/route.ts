import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const registrations = await prisma.registration.findMany({
      include: {
        attendees: true,
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
