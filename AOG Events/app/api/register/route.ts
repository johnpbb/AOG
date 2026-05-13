import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { REGISTRATION_CATEGORIES } from "@/lib/types";
import {
  sendPendingRegistrationEmail,
  sendAdminNotificationEmail,
} from "@/lib/email";

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

    const result = await prisma.$transaction(async (tx) => {
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

      if (catInfo) {
        const ticketCount = await tx.ticket.count({
          where: { status: "ACTIVE", registration: { category } },
        });
        const remaining = catInfo.ticketPool - ticketCount;
        if (qty > remaining) {
          throw new Error(
            `POOL_EXCEEDED: Only ${remaining} tickets remain in the ${catInfo.name} pool. You requested ${qty}.`
          );
        }
      }

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

      const maxResult = await tx.$queryRaw<{ max: string | null }[]>`
        SELECT MAX(CAST(SUBSTRING("ticketNumber" FROM 9) AS INTEGER)) AS max
        FROM "Ticket"
        WHERE "ticketNumber" LIKE 'AOG-TKT-%'
      `;
      const nextSeq = (Number(maxResult[0]?.max) || 0) + 1;

      const ticketData = Array.from({ length: qty }, (_, i) => ({
        ticketNumber: padTicketNumber(nextSeq + i),
        registrationId: registration.id,
        status: "ACTIVE" as const,
      }));

      await tx.ticket.createMany({ data: ticketData });

      await tx.venue.update({
        where: { id: venue },
        data: { currentRegistrations: { increment: qty } },
      });

      const tickets = await tx.ticket.findMany({
        where: { registrationId: registration.id },
        orderBy: { ticketNumber: "asc" },
      });

      return { registration, tickets };
    });

    // ── Send emails for bank transfer registrations ────────────────────────
    if (paymentMethod !== "online" && email && email !== "unknown") {
      const [siteConfig, event] = await Promise.all([
        prisma.siteConfig.findUnique({ where: { id: "default" } }),
        prisma.event.findUnique({ where: { id: eventId }, select: { name: true } }),
      ]);

      const registrantName =
        rest.pastorName || rest.firstName
          ? `${rest.firstName ?? ""} ${rest.lastName ?? ""}`.trim() || rest.pastorName
          : email;

      const eventName = event?.name ?? "AOG Fiji 100th Anniversary";

      const emailParams = {
        registrantName: String(registrantName),
        registrationId: result.registration.registrationId,
        category: catInfo?.name ?? category,
        numberOfTickets: qty,
        fee: result.registration.fee,
        bankName: siteConfig?.bankName ?? "",
        bankAccountName: siteConfig?.bankAccountName ?? "",
        bankAccountNumber: siteConfig?.bankAccountNumber ?? "",
        bankBranch: siteConfig?.bankBranch ?? "",
        eventName,
      };

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      await Promise.allSettled([
        sendPendingRegistrationEmail({ to: email, ...emailParams }),
        siteConfig?.notificationEmail
          ? sendAdminNotificationEmail({
              to: siteConfig.notificationEmail,
              registrantEmail: email,
              adminUrl: `${appUrl}/admin`,
              ...emailParams,
            })
          : Promise.resolve(),
      ]);
    }

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
      { error: "Registration failed. Please try again or contact support." },
      { status: 500 }
    );
  }
}
