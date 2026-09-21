import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { amendRegistration, AmendError, type AmendAttendeeInput } from "@/lib/amend-registration";
import { attachVenuesToTickets, summarizeTicketVenues, deriveRegistrationTypeLabel, formatPaymentStatusLabel } from "@/lib/tickets";
import { sendTicketConfirmationEmail } from "@/lib/email";
import { REGISTRATION_CATEGORIES } from "@/lib/types";
import { format } from "date-fns";

// POST /api/admin/registrations/[id]/amend — edit a registration's headcount
// and/or named attendee list after the fact, including post-payment (which
// the public self-amend flow refuses to do). Reissues nothing: existing
// tickets keep their numbers and QR codes, only the delta is created or
// cancelled. See lib/amend-registration.ts for the reconciliation rules.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const attendees: AmendAttendeeInput[] | null = Array.isArray(body.attendees)
    ? body.attendees.map((a: any) => ({
        firstName: String(a.firstName ?? "").trim(),
        lastName: String(a.lastName ?? "").trim(),
        ageCategory: a.ageCategory === "YOUTH" ? "YOUTH" : "ADULT",
        email: a.email ? String(a.email).trim() : null,
        phone: a.phone ? String(a.phone).trim() : null,
      }))
    : null;

  if (attendees?.some((a) => !a.firstName || !a.lastName)) {
    return NextResponse.json({ error: "Every attendee needs a first and last name." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction((tx) =>
      amendRegistration(
        tx,
        id,
        { adults: body.adults, youth: body.youth, kids: body.kids, attendees, note: body.note },
        { id: currentUser.id, name: currentUser.name }
      )
    );

    // Tickets changed materially, so the copy the registrant is holding is
    // now wrong — offer to push a fresh set. Best-effort: a mail failure
    // must not make the (already committed) amendment look like it failed.
    let emailSent = false;
    let emailError: string | null = null;
    if (body.resendTickets && result.ticketsIssued) {
      try {
        await sendAmendedTickets(id);
        emailSent = true;
      } catch (err: any) {
        console.error("Amend ticket resend error:", err);
        emailError = "The amendment saved, but the ticket email could not be sent.";
      }
    }

    const summary: string[] = [];
    if (result.ticketsAdded > 0) summary.push(`${result.ticketsAdded} ticket(s) issued`);
    if (result.ticketsCancelled > 0) summary.push(`${result.ticketsCancelled} ticket(s) cancelled`);
    if (result.before.fee !== result.after.fee) {
      summary.push(`fee updated to $${result.after.fee.toLocaleString()}`);
    }
    if (emailSent) summary.push("updated tickets emailed");

    return NextResponse.json({
      success: true,
      ...result,
      emailSent,
      emailError,
      message:
        `Registration ${result.registrationId} amended` +
        (summary.length > 0 ? ` — ${summary.join(", ")}.` : "."),
    });
  } catch (error: any) {
    if (error instanceof AmendError) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Registration not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Amend registration error:", error);
    return NextResponse.json({ error: "Failed to amend registration" }, { status: 500 });
  }
}

/** Re-sends the full current ticket set (post-amendment) to the registrant. */
async function sendAmendedTickets(id: string) {
  const registration = await prisma.registration.findUnique({
    where: { id },
    include: {
      tickets: {
        where: { status: "ACTIVE" },
        select: {
          ticketNumber: true,
          ticketType: true,
          attendee: { select: { firstName: true, lastName: true } },
        },
        orderBy: { ticketNumber: "asc" },
      },
      venue: { select: { name: true, city: true } },
      venueAllocations: { include: { venue: { select: { name: true, city: true } } } },
      event: { select: { name: true, startDate: true } },
      church: { select: { name: true, district: true, country: true } },
      payments: { where: { status: "CONFIRMED" }, select: { amount: true } },
    },
  });

  if (!registration || registration.tickets.length === 0) return;
  if (!registration.email || registration.email === "unknown") return;

  const formData = registration.formData as Record<string, any>;
  const registrantName =
    registration.church?.name ||
    formData?.pastorName ||
    (formData?.firstName ? `${formData.firstName} ${formData.lastName ?? ""}`.trim() : null) ||
    registration.registrarName ||
    registration.email;

  const totalPaid = registration.payments.reduce((sum, p) => sum + p.amount, 0);
  const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === registration.category);
  const ticketsWithVenue = attachVenuesToTickets(registration.tickets, registration.venueAllocations).map((t) => ({
    ...t,
    attendeeName: t.attendee ? `${t.attendee.firstName} ${t.attendee.lastName}`.trim() : undefined,
  }));

  await sendTicketConfirmationEmail({
    to: registration.email,
    registrantName: String(registrantName),
    registrationId: registration.registrationId,
    category: catInfo?.name ?? registration.category,
    categoryId: registration.category,
    registrationType: deriveRegistrationTypeLabel(registration.type, registration.category),
    churchName: registration.church?.name,
    district: registration.church?.district ?? undefined,
    country: registration.church?.country,
    paymentStatusLabel: formatPaymentStatusLabel(registration.fee, totalPaid),
    eventName: registration.event?.name ?? "AOG Fiji 100th Anniversary",
    eventDate: registration.event?.startDate
      ? format(new Date(registration.event.startDate), "d MMMM yyyy")
      : "TBC",
    venueName: summarizeTicketVenues(ticketsWithVenue) || registration.venue?.name || "",
    venueCity: registration.venue?.city ?? "",
    tickets: ticketsWithVenue,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  });
}
