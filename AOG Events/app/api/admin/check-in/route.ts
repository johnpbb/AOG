import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { registrationId } = await request.json();

    if (!registrationId) {
      return NextResponse.json({ error: "Registration ID is required" }, { status: 400 });
    }

    // Find the registration
    const registration = await prisma.registration.findUnique({
      where: { registrationId },
      include: {
        attendees: true,
      },
    });

    if (!registration) {
      return NextResponse.json({ 
        success: false, 
        message: "Invalid registration ID" 
      }, { status: 404 });
    }

    // Check if already checked in
    if (registration.checkedInAt) {
      const name = registration.attendees.length > 0 
        ? `${registration.attendees[0].firstName} ${registration.attendees[0].lastName}`
        : "N/A";
        
      return NextResponse.json({
        success: false,
        alreadyCheckedIn: true,
        registrationId: registration.registrationId,
        name,
        category: registration.category,
        venue: registration.venueId,
        message: `Already checked in at ${registration.checkedInAt.toLocaleTimeString()}`,
      });
    }

    // Perform check-in
    const updatedRegistration = await prisma.registration.update({
      where: { registrationId },
      data: {
        checkedInAt: new Date(),
      },
      include: {
        attendees: true,
      }
    });

    const name = updatedRegistration.attendees.length > 0 
      ? `${updatedRegistration.attendees[0].firstName} ${updatedRegistration.attendees[0].lastName}`
      : "N/A";

    return NextResponse.json({
      success: true,
      registrationId: updatedRegistration.registrationId,
      name,
      category: updatedRegistration.category,
      venue: updatedRegistration.venueId,
      message: "Check-in successful!",
    });

  } catch (error: any) {
    console.error("Check-in Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
