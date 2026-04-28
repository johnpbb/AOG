import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { REGISTRATION_CATEGORIES } from "@/lib/types";

function padTicketNumber(n: number): string {
  return `AOG-TKT-${String(n).padStart(5, "0")}`;
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const {
      registrationId,
      category,
      type = "individual",
      email,
      phone,
      venue,
      eventId,
      paymentMethod,
      fee,
      numberOfTickets = 1,
      // Legacy attendees array (no longer used in new forms, kept for compat)
      attendees,
      ...rest
    } = data;

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    if (!venue) {
      return NextResponse.json({ error: "venue (venueId) is required" }, { status: 400 });
    }

    const qty = Math.max(1, parseInt(String(numberOfTickets), 10) || 1);
    const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === category);

    // ── Transaction: check limits + create registration + tickets ──────────
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check registration count limit
      if (catInfo?.registrationLimit !== null && catInfo?.registrationLimit !== undefined) {
        const regCount = await tx.registration.count({
          where: { category, paymentStatus: "COMPLETED" },
        });
        if (regCount >= catInfo.registrationLimit) {
          throw new Error(
            `LIMIT_REACHED: All ${catInfo.registrationLimit} registrations for ${catInfo.name} have been received.`
          );
        }
      }

      // 2. Check ticket pool
      if (catInfo) {
        const ticketCount = await tx.ticket.count({
          where: {
            status: "ACTIVE",
            registration: { category },
          },
        });
        const remaining = catInfo.ticketPool - ticketCount;
        if (qty > remaining) {
          throw new Error(
            `POOL_EXCEEDED: Only ${remaining} tickets remain in the ${catInfo.name} pool. You requested ${qty}.`
          );
        }
      }

      // 3. Create registration
      const registration = await tx.registration.create({
        data: {
          registrationId,
          category: category || "unknown",
          type: (type || "individual").toUpperCase() as any,
          email: email || "unknown",
          phone: phone || null,
          eventId,
          venueId: venue,
          fee: parseFloat(String(fee)) || 0,
          paymentMethod: paymentMethod === "online" ? "ONLINE" : "BANK_TRANSFER",
          paymentStatus: "PENDING",
          formData: rest || {},
          numberOfAttendees: qty,
          // Legacy: if old form passes attendees array, still save them
          ...(Array.isArray(attendees) && attendees.length > 0
            ? {
                attendees: {
                  create: attendees.map((a: any) => ({
                    firstName: a.firstName,
                    lastName: a.lastName,
                    email: a.email || null,
                    phone: a.phone || null,
                  })),
                },
              }
            : {}),
        },
      });

      // 4. Generate N tickets with sequential numbers
      const lastTicket = await tx.ticket.findFirst({
        orderBy: { ticketNumber: "desc" },
        select: { ticketNumber: true },
      });

      let nextSeq = 1;
      if (lastTicket) {
        const match = lastTicket.ticketNumber.match(/AOG-TKT-(\d+)/);
        if (match) nextSeq = parseInt(match[1], 10) + 1;
      }

      const ticketData = Array.from({ length: qty }, (_, i) => ({
        ticketNumber: padTicketNumber(nextSeq + i),
        registrationId: registration.id,
        status: "ACTIVE" as const,
      }));

      await tx.ticket.createMany({ data: ticketData });

      // 5. Update venue currentRegistrations
      await tx.venue.update({
        where: { id: venue },
        data: { currentRegistrations: { increment: qty } },
      });

      // Return created tickets for email/QR generation
      const tickets = await tx.ticket.findMany({
        where: { registrationId: registration.id },
        orderBy: { ticketNumber: "asc" },
      });

      return { registration, tickets };
    });

    return NextResponse.json({
      success: true,
      id: result.registration.id,
      registrationId: result.registration.registrationId,
      tickets: result.tickets.map((t) => ({ id: t.id, ticketNumber: t.ticketNumber })),
    });
  } catch (error: any) {
    console.error("Registration Error:", error);

    if (error.message?.startsWith("LIMIT_REACHED:") || error.message?.startsWith("POOL_EXCEEDED:")) {
      const userMessage = error.message.replace(/^[A-Z_]+: /, "");
      return NextResponse.json({ error: userMessage }, { status: 409 });
    }

    return NextResponse.json(
      { error: error.message, details: process.env.NODE_ENV === "development" ? error : undefined },
      { status: 500 }
    );
  }
}
