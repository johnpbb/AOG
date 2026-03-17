import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log("Incoming Registration Data:", data);

    const { 
      registrationId, 
      category, 
      type = "individual", // Default to individual if missing
      email, 
      phone, 
      venue, 
      paymentMethod, 
      fee,
      attendees,
      ...rest 
    } = data;

    // Create the registration in the database
    const registration = await prisma.registration.create({
      data: {
        registrationId,
        category: category || "unknown",
        type: (type || "individual").toUpperCase() as any, // CHURCH or INDIVIDUAL
        email: email || "unknown",
        phone: phone || null,
        venueId: venue || "unknown",
        fee: parseFloat(fee) || 0,
        paymentMethod: paymentMethod === 'online' ? 'ONLINE' : 'BANK_TRANSFER',
        paymentStatus: 'PENDING',
        formData: rest || {},
        numberOfAttendees: Array.isArray(attendees) ? attendees.length : 1,
        attendees: {
          create: Array.isArray(attendees) 
            ? attendees.map((a: any) => ({
                firstName: a.firstName,
                lastName: a.lastName,
                email: a.email || null,
                phone: a.phone || null,
              }))
            : []
        }
      }
    });

    return NextResponse.json({ success: true, id: registration.id });
  } catch (error: any) {
    console.error("Database Save Error:", error);
    return NextResponse.json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}
