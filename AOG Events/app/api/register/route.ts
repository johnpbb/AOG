import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  sendPendingRegistrationEmail,
  sendAdminNotificationEmail,
} from "@/lib/email";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createRegistrationRecord, RegistrationCapacityError } from "@/lib/create-registration";

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

    const result = await prisma.$transaction((tx) =>
      createRegistrationRecord(tx, {
        category,
        type,
        email: email || "unknown",
        phone,
        churchId,
        registrarName,
        contactPreference,
        contactPhone,
        contactEmail,
        eventId,
        paymentMethod,
        fee: parseFloat(String(fee)) || 0,
        numberOfTickets: Math.max(1, parseInt(String(numberOfTickets), 10) || 1),
        adults: Math.max(0, parseInt(String(adults), 10) || 0),
        youth: Math.max(0, parseInt(String(youth), 10) || 0),
        kids: Math.max(0, parseInt(String(kids), 10) || 0),
        paymentType,
        installmentCount: parseInt(String(installmentCount), 10) || undefined,
        attendees,
        formData: rest || {},
      })
    );

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
        category: result.catInfo?.name ?? category,
        numberOfTickets: result.qty,
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

    if (result.venueWarnings.length > 0) {
      console.warn(`Venue assignment gaps for ${result.registration.registrationId}:`, result.venueWarnings);
    }

    return NextResponse.json({
      success: true,
      id: result.registration.id,
      registrationId: result.registration.registrationId,
      tickets: [] as { id: string; ticketNumber: string }[],
    });
  } catch (error: any) {
    console.error("Registration Error:", error);

    if (error instanceof RegistrationCapacityError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: "Registration failed. Please try again or contact support." },
      { status: 500 }
    );
  }
}
