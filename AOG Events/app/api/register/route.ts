import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { REGISTRATION_CATEGORIES, INSTALLMENT_DEADLINE } from "@/lib/types";
import {
  sendPendingRegistrationEmail,
  sendAdminNotificationEmail,
} from "@/lib/email";

async function verifyTurnstileToken(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // widget not configured — skip verification
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const result = await res.json();
  return result.success === true;
}

// Builds the spec's reference number: AG100-{3-digit churchId}{categoryCode}{total}.
// Non-church registrations (no real Church match) use "000" as the church-ID block.
// If the exact combination already exists (e.g. same church re-registers at the
// same headcount), a numeric suffix is appended to keep the ID unique.
async function generateRegistrationId(
  tx: any,
  churchId: string | null,
  categoryCode: string,
  total: number
): Promise<string> {
  const base = `AG100-${churchId ?? "000"}${categoryCode}${total}`;
  let candidate = base;
  let suffix = 2;
  while (await tx.registration.findUnique({ where: { registrationId: candidate } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const {
      category,
      type = "individual",
      email,
      phone,
      churchId,
      registrarName,
      contactPreference,
      contactPhone,
      contactEmail,
      venue,
      eventId,
      paymentMethod,
      fee,
      numberOfTickets = 1,
      adults,
      youth,
      kids,
      paymentType,
      installmentCount,
      attendees,
      turnstileToken,
      ...rest
    } = data;

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const humanVerified = await verifyTurnstileToken(turnstileToken, clientIp);
    if (!humanVerified) {
      return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 400 });
    }

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    if (!venue) {
      return NextResponse.json({ error: "venue (venueId) is required" }, { status: 400 });
    }

    const isChurchPath = (type || "").toLowerCase() === "church";
    const numAdults = isChurchPath ? Math.max(0, parseInt(String(adults), 10) || 0) : 0;
    const numYouth = isChurchPath ? Math.max(0, parseInt(String(youth), 10) || 0) : 0;
    const numKids = isChurchPath ? Math.max(0, parseInt(String(kids), 10) || 0) : 0;
    const qty = isChurchPath
      ? numAdults + numYouth + numKids
      : Math.max(1, parseInt(String(numberOfTickets), 10) || 1);
    // Kids don't receive a ticket/QR code — only adults and youth do.
    const ticketQty = isChurchPath ? numAdults + numYouth : qty;
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
        // Seats are reserved against the pool the moment a registration is
        // submitted (even while payment is pending) — entry QR tickets
        // themselves aren't generated until the registration is fully paid
        // (see lib/tickets.ts), so we can't count Ticket rows here.
        const activeRegs = await tx.registration.findMany({
          where: { category, paymentStatus: { not: "CANCELLED" } },
          select: { type: true, adults: true, youth: true, numberOfAttendees: true },
        });
        const reservedSeats = activeRegs.reduce(
          (sum: number, r: any) => sum + (r.type === "CHURCH" ? r.adults + r.youth : r.numberOfAttendees),
          0
        );
        const remaining = catInfo.ticketPool - reservedSeats;
        if (ticketQty > remaining) {
          throw new Error(
            `POOL_EXCEEDED: Only ${remaining} seats remain in the ${catInfo.name} pool. You requested ${ticketQty}.`
          );
        }
      }

      const registrationId = await generateRegistrationId(
        tx,
        churchId || null,
        catInfo?.categoryCode ?? "XX",
        qty
      );

      const registration = await tx.registration.create({
        data: {
          registrationId,
          category: category || "unknown",
          type: (type || "individual").toUpperCase() as any,
          churchId: churchId || null,
          email: email || "unknown",
          phone: phone || null,
          registrarName: registrarName || null,
          contactPreference: contactPreference || null,
          contactPhone: contactPhone || null,
          contactEmail: contactEmail || null,
          eventId,
          venueId: venue,
          fee: parseFloat(String(fee)) || 0,
          paymentMethod: paymentMethod === "online" ? "ONLINE" : "BANK_TRANSFER",
          paymentStatus: "PENDING",
          formData: rest || {},
          numberOfAttendees: qty,
          adults: numAdults,
          youth: numYouth,
          kids: numKids,
          paymentType: paymentType === "partial" ? "partial" : "full",
          installmentCount: paymentType === "partial" ? parseInt(String(installmentCount), 10) || null : null,
          installmentDeadline: paymentType === "partial" ? INSTALLMENT_DEADLINE : null,
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

      await tx.venue.update({
        where: { id: venue },
        data: { currentRegistrations: { increment: ticketQty } },
      });

      // Entry QR tickets are issued only once the registration is fully paid
      // (see lib/tickets.ts) — via admin approval, the finance ledger, or the
      // online-payment verification callback. None exist yet at submission time.
      return { registration, tickets: [] as { id: string; ticketNumber: string }[] };
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
        paymentType: result.registration.paymentType,
        installmentCount: result.registration.installmentCount,
        installmentDeadline: result.registration.installmentDeadline
          ? result.registration.installmentDeadline.toLocaleDateString("en-FJ", { day: "numeric", month: "long", year: "numeric" })
          : undefined,
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
