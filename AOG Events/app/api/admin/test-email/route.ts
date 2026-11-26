import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendTicketConfirmationEmail } from "@/lib/email";
import { describeEmailError, isUsableEmail } from "@/lib/send-registration-tickets";
import { format } from "date-fns";

// POST /api/admin/test-email { to } — sends a sample ticket pack through the
// production SMTP account to an address staff choose, so the whole chain
// (Gmail login, template, PDF, attachment) can be checked without emailing
// a registrant. Writes nothing and uses no real ticket numbers; the sample
// QR codes don't match any ticket, so they won't scan in at check-in.
// Registration Desk accounts are refused by the middleware (lib/roles.ts).
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const to = String(body?.to ?? "").trim();
  if (!isUsableEmail(to)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const event = await prisma.event.findFirst({ orderBy: { startDate: "asc" }, select: { name: true, startDate: true } });
  const from = process.env.SMTP_FROM_EMAIL ?? "(SMTP_FROM_EMAIL not set)";
  const started = Date.now();

  try {
    await sendTicketConfirmationEmail({
      to,
      subjectPrefix: "[TEST] ",
      registrantName: "Sample Registrant",
      registrationId: "AG100-TEST",
      category: "Test Email",
      registrationType: "Church",
      churchName: "Sample Church (test only)",
      district: "Test District",
      country: "Fiji",
      paymentStatusLabel: "PAID IN FULL",
      eventName: event?.name ?? "AOG Fiji 100th Anniversary",
      eventDate: event?.startDate ? format(new Date(event.startDate), "d MMMM yyyy") : "TBC",
      venueName: "Sample Venue",
      venueCity: "Suva",
      tickets: [
        { ticketNumber: "TEST-SAMPLE-1", ticketType: "ADULT", attendeeName: "Sample Adult" },
        { ticketNumber: "TEST-SAMPLE-2", ticketType: "YOUTH", attendeeName: "Sample Youth" },
      ],
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    });
    console.log(`Test ticket email sent to ${to} by ${currentUser.name}`);
    return NextResponse.json({ ok: true, to, from, ms: Date.now() - started });
  } catch (err) {
    console.error("Test ticket email failed:", err);
    return NextResponse.json({ ok: false, to, from, error: describeEmailError(err) });
  }
}
