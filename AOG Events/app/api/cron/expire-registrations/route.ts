import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { sendExpiryReminderEmail } from "@/lib/email";
import { cancelRegistration } from "@/lib/cancel-registration";
import { REGISTRATION_CATEGORIES } from "@/lib/types";

const WARNING_DAYS = 4;
const EXPIRY_DAYS = 5;

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function registrantName(registration: { formData: any; email: string }) {
  const formData = registration.formData as Record<string, any>;
  return (
    formData?.pastorName ||
    (formData?.firstName ? `${formData.firstName} ${formData.lastName ?? ""}`.trim() : null) ||
    registration.email
  );
}

// POST /api/cron/expire-registrations
// Called daily by an external cron job. Warns registrants whose pending, unpaid
// bank transfer registration is 1 day from auto-cancellation, then cancels any
// that have hit the cutoff — returning their tickets/seats to the pool. Any
// registration with even one logged Payment (e.g. an installment plan) is
// exempt, since it's governed by its own installmentDeadline instead.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const warned: string[] = [];
  const cancelled: string[] = [];
  const errors: { registrationId: string; error: string }[] = [];

  const toWarn = await prisma.registration.findMany({
    where: {
      paymentStatus: PaymentStatus.PENDING,
      payments: { none: {} },
      expiryReminderSentAt: null,
      createdAt: { lte: daysAgo(WARNING_DAYS) },
    },
    include: {
      church: { select: { name: true } },
      event: { select: { name: true } },
      tickets: { select: { id: true } },
    },
  });

  for (const registration of toWarn) {
    try {
      await sendExpiryReminderEmail({
        to: registration.email,
        registrantName: registrantName(registration),
        churchName: registration.church?.name,
        registrationId: registration.registrationId,
        category: REGISTRATION_CATEGORIES.find((c) => c.id === registration.category)?.name ?? registration.category,
        numberOfTickets: registration.tickets.length || registration.numberOfAttendees,
        fee: registration.fee,
        eventName: registration.event?.name ?? "AOG Fiji 100th Anniversary",
      });
      await prisma.registration.update({
        where: { id: registration.id },
        data: { expiryReminderSentAt: new Date() },
      });
      warned.push(registration.registrationId);
    } catch (error: any) {
      errors.push({ registrationId: registration.registrationId, error: error.message });
    }
  }

  const toExpire = await prisma.registration.findMany({
    where: {
      paymentStatus: PaymentStatus.PENDING,
      payments: { none: {} },
      createdAt: { lte: daysAgo(EXPIRY_DAYS) },
    },
    select: { id: true, registrationId: true },
  });

  for (const registration of toExpire) {
    try {
      await prisma.$transaction((tx) => cancelRegistration(tx, registration.id));
      cancelled.push(registration.registrationId);
    } catch (error: any) {
      errors.push({ registrationId: registration.registrationId, error: error.message });
    }
  }

  return NextResponse.json({ success: true, warned, cancelled, errors });
}
