import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { amendRegistration, AmendError, type AmendAttendeeInput } from "@/lib/amend-registration";
import { sendRegistrationTickets } from "@/lib/send-registration-tickets";

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
        {
          adults: body.adults,
          youth: body.youth,
          kids: body.kids,
          attendees,
          attendeeMode: body.attendeeMode === "append" ? "append" : "replace",
          note: body.note,
          overrideCaps: body.overrideCaps === true,
        },
        { id: currentUser.id, name: currentUser.name }
      )
    );

    // Tickets changed materially, so the copy the registrant is holding is
    // now wrong — offer to push a fresh set. Best-effort: a mail failure
    // must not make the (already committed) amendment look like it failed.
    let emailSent = false;
    let emailError: string | null = null;
    if (body.resendTickets && result.ticketsIssued) {
      const outcome = await sendRegistrationTickets(id);
      if (outcome.status === "sent") emailSent = true;
      else if (outcome.status === "failed") {
        emailError = `The amendment saved, but the ticket email could not be sent: ${outcome.error}`;
      } else {
        emailError = `The amendment saved, but no ticket email was sent: ${outcome.reason}.`;
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
