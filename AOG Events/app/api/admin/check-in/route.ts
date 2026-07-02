import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Fiji is UTC+12
const FIJI_OFFSET_MS = 12 * 60 * 60 * 1000;

function getFijiDateString(date: Date = new Date()): string {
  return new Date(date.getTime() + FIJI_OFFSET_MS).toISOString().slice(0, 10);
}

function formatFijiTime(date: Date): string {
  return new Date(date.getTime() + FIJI_OFFSET_MS)
    .toISOString()
    .slice(11, 16); // HH:MM
}

const TICKET_NUMBER_RE = /^AOG-TKT-\d+$/;

// ─── GET /api/admin/check-in?date=YYYY-MM-DD ───────────────────────────────
// Returns daily stats: check-ins, check-outs, currently inside, flagged anomalies
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || getFijiDateString();

  try {
    const events = await prisma.attendanceEvent.findMany({
      where: { eventDate: date },
      include: {
        ticket: { select: { ticketNumber: true, ticketType: true } },
        registration: {
          select: {
            registrationId: true,
            category: true,
            venueId: true,
            numberOfAttendees: true,
            attendees: { select: { firstName: true, lastName: true }, take: 1 },
          },
        },
      },
      orderBy: { timestamp: "desc" },
    });

    const flagged = await prisma.attendanceEvent.findMany({
      where: { isFlagged: true },
      include: {
        ticket: { select: { ticketNumber: true, ticketType: true } },
        registration: {
          select: {
            registrationId: true,
            category: true,
            attendees: { select: { firstName: true, lastName: true }, take: 1 },
          },
        },
      },
      orderBy: { timestamp: "desc" },
      take: 50,
    });

    const totalTickets = await prisma.ticket.count({ where: { status: "ACTIVE" } });
    const totalRegistrations = await prisma.registration.count({
      where: { paymentStatus: "COMPLETED" },
    });

    // "Currently inside" = tickets (or, for legacy rows with no ticketId,
    // registrations) whose latest event today is CHECK_IN
    const keyOf = (e: (typeof events)[number]) => e.ticketId ?? `reg:${e.registrationId}`;
    const latestPerKey = new Map<string, string>();
    const typeByKey = new Map<string, "ADULT" | "YOUTH">();
    for (const e of [...events].reverse()) {
      latestPerKey.set(keyOf(e), e.type);
      if (e.ticket) typeByKey.set(keyOf(e), e.ticket.ticketType);
    }

    let currentlyInside = 0;
    const insideByType = { ADULT: 0, YOUTH: 0 };
    for (const [key, type] of latestPerKey) {
      if (type !== "CHECK_IN") continue;
      currentlyInside++;
      const ticketType = typeByKey.get(key);
      if (ticketType) insideByType[ticketType]++;
    }

    return NextResponse.json({
      date,
      events,
      checkInsToday: events.filter(e => e.type === "CHECK_IN").length,
      checkOutsToday: events.filter(e => e.type === "CHECK_OUT").length,
      currentlyInside,
      insideByType,
      totalTickets,
      totalRegistrations,
      flagged,
    });
  } catch (error: any) {
    console.error("GET check-in error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST /api/admin/check-in ──────────────────────────────────────────────
// Ticket QR scan handler — auto-detects CHECK_IN / CHECK_OUT / RE_ENTRY,
// scoped per-ticket rather than per-registration.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code: string = String(body.code ?? body.ticketNumber ?? "").trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ error: "Ticket code is required" }, { status: 400 });
    }

    if (!TICKET_NUMBER_RE.test(code)) {
      return NextResponse.json({
        success: false,
        message: "❌ Invalid ticket code — expected format AOG-TKT-00001",
      }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: code },
      include: {
        registration: {
          include: {
            attendees: { take: 1 },
            venue: { select: { name: true } },
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({
        success: false,
        message: "❌ Invalid ticket — not found",
      }, { status: 404 });
    }

    if (ticket.status === "CANCELLED") {
      return NextResponse.json({
        success: false,
        ticketNumber: ticket.ticketNumber,
        message: "🚫 Ticket cancelled — entry denied",
      });
    }

    const registration = ticket.registration;
    const today = getFijiDateString();
    const name = registration.attendees[0]
      ? `${registration.attendees[0].firstName} ${registration.attendees[0].lastName}`
      : registration.registrationId;
    const venueName = registration.venue?.name || registration.venueId;

    // Get last event for today for this ticket to determine what action to take
    const lastEvent = await prisma.attendanceEvent.findFirst({
      where: { ticketId: ticket.id, eventDate: today },
      orderBy: { timestamp: "desc" },
    });

    let action: "CHECK_IN" | "CHECK_OUT" | "RE_ENTRY";
    let type: "CHECK_IN" | "CHECK_OUT";
    let message: string;

    if (!lastEvent || lastEvent.type === "CHECK_OUT") {
      // No event yet today OR last event was CHECK_OUT → this is a CHECK_IN (or re-entry)
      action = lastEvent?.type === "CHECK_OUT" ? "RE_ENTRY" : "CHECK_IN";
      type = "CHECK_IN";
      message = action === "RE_ENTRY" ? "🔄 Re-entry recorded — Welcome back!" : "✅ Checked in — Welcome!";
    } else {
      // Last event was CHECK_IN → this is a CHECK_OUT
      action = "CHECK_OUT";
      type = "CHECK_OUT";
      message = "👋 Checked out — See you next session!";
    }

    // Create attendance event
    await prisma.attendanceEvent.create({
      data: {
        registrationId: registration.id,
        ticketId: ticket.id,
        eventDate: today,
        type,
      },
    });

    // Create DailyCheckIn on first check-in of the day
    if (type === "CHECK_IN" && action === "CHECK_IN") {
      await prisma.dailyCheckIn.upsert({
        where: { ticketId_checkInDate: { ticketId: ticket.id, checkInDate: today } },
        create: { registrationId: registration.id, ticketId: ticket.id, checkInDate: today },
        update: {},
      });

      if (!registration.checkedInAt) {
        await prisma.registration.update({
          where: { id: registration.id },
          data: { checkedInAt: new Date() },
        });
      }
    }

    return NextResponse.json({
      success: true,
      action,
      ticketNumber: ticket.ticketNumber,
      ticketType: ticket.ticketType,
      registrationId: registration.registrationId,
      name,
      category: registration.category,
      venue: venueName,
      message,
    });

  } catch (error: any) {
    console.error("Check-in Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PATCH /api/admin/check-in ─────────────────────────────────────────────
// Admin manual force-checkout by ticket — flags if no prior check-in today
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const code: string = String(body.ticketNumber ?? body.code ?? "").trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ error: "Ticket code is required" }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: code },
      include: { registration: { include: { attendees: { take: 1 } } } },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const registration = ticket.registration;
    const today = getFijiDateString();

    const hasCheckInToday = await prisma.attendanceEvent.findFirst({
      where: { ticketId: ticket.id, eventDate: today, type: "CHECK_IN" },
    });

    const isFlagged = !hasCheckInToday;

    await prisma.attendanceEvent.create({
      data: {
        registrationId: registration.id,
        ticketId: ticket.id,
        eventDate: today,
        type: "CHECK_OUT",
        isFlagged,
        flagReason: isFlagged ? "Manual checkout recorded with no prior check-in today" : null,
      },
    });

    const name = registration.attendees[0]
      ? `${registration.attendees[0].firstName} ${registration.attendees[0].lastName}`
      : registration.registrationId;

    return NextResponse.json({
      success: true,
      isFlagged,
      name,
      ticketNumber: ticket.ticketNumber,
      registrationId: registration.registrationId,
      message: isFlagged
        ? "⚠️ Checkout recorded and flagged — no check-in found for today"
        : "✅ Manual checkout recorded",
    });
  } catch (error: any) {
    console.error("Manual checkout error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE /api/admin/check-in?eventId=xxx ────────────────────────────────
// Resolve (dismiss) a flagged anomaly
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  try {
    await prisma.attendanceEvent.update({
      where: { id: eventId },
      data: { isFlagged: false, flagReason: "Reviewed and resolved by admin" },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
