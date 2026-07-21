import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createAmendToken } from "@/lib/amend-token";
import { REGISTRATION_CATEGORIES } from "@/lib/types";

const normalizeEmail = (v: string) => v.trim().toLowerCase();
const normalizePhone = (v: string) => v.replace(/\D/g, "");

// POST /api/register/lookup — the entry point for the public "amend my
// registration" flow. Verifies the registrant knows both their registration
// code AND an email/phone already on file before handing out a short-lived
// token the amend endpoint will accept. Deliberately returns the same
// generic error whether the code doesn't exist or the contact doesn't match,
// so this can't be used to enumerate valid registration codes (the code
// format — AG100-{churchId}{categoryCode}{total} — is somewhat guessable).
export async function POST(request: Request) {
  try {
    const { registrationId, contact, turnstileToken } = await request.json();

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const humanVerified = await verifyTurnstileToken(turnstileToken, clientIp);
    if (!humanVerified) {
      return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 400 });
    }

    if (!registrationId || !contact) {
      return NextResponse.json({ error: "Registration code and contact details are required." }, { status: 400 });
    }

    const registration = await prisma.registration.findUnique({
      where: { registrationId: String(registrationId).trim() },
    });

    const GENERIC_ERROR = { error: "We couldn't find a registration matching that code and contact detail." };

    if (!registration) {
      return NextResponse.json(GENERIC_ERROR, { status: 404 });
    }

    const inputTrimmed = String(contact).trim();
    const candidates = [registration.email, registration.phone, registration.contactEmail, registration.contactPhone].filter(
      (v): v is string => !!v
    );
    const matches = candidates.some(
      (c) => normalizeEmail(c) === normalizeEmail(inputTrimmed) || (normalizePhone(c) && normalizePhone(c) === normalizePhone(inputTrimmed))
    );

    if (!matches) {
      return NextResponse.json(GENERIC_ERROR, { status: 404 });
    }

    if (registration.paymentStatus === "CANCELLED") {
      return NextResponse.json(
        { error: "This registration has been cancelled. Please contact the event team if you need to re-register." },
        { status: 409 }
      );
    }

    const token = createAmendToken(registration.id);
    const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === registration.category);

    return NextResponse.json({
      token,
      registration: {
        registrationId: registration.registrationId,
        type: registration.type,
        categoryName: catInfo?.name ?? registration.category,
        paymentStatus: registration.paymentStatus,
        headcountLocked: registration.paymentStatus === "COMPLETED",
        registrarName: registration.registrarName,
        pastorName: (registration.formData as any)?.pastorName ?? null,
        contactPreference: registration.contactPreference,
        contactPhone: registration.contactPhone,
        contactEmail: registration.contactEmail,
        email: registration.email,
        phone: registration.phone,
        adults: registration.adults,
        youth: registration.youth,
        kids: registration.kids,
        numberOfTickets: registration.numberOfAttendees,
        maxTicketsPerReg: catInfo?.maxTicketsPerReg ?? null,
      },
    });
  } catch (error: any) {
    console.error("Registration lookup error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
