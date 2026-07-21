import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifyAmendToken } from "@/lib/amend-token";
import { REGISTRATION_CATEGORIES } from "@/lib/types";
import { autoAssignVenues, applyVenueAllocations, releaseVenueAllocations } from "@/lib/venue-assignment";

// POST /api/register/amend — the write side of the public self-amend flow.
// Requires a token minted by /api/register/lookup (proves the registrant
// already passed the code+contact check) rather than accepting raw contact
// info again, so this isn't a second guessable auth surface.
//
// Contact-detail fields are always editable. Headcount fields (adults/
// youth/kids for church registrations, numberOfTickets for individual) are
// locked once payment is COMPLETED — a genuine post-payment headcount change
// goes through admin/finance manually, per the confirmed product decision.
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { token, registrarName, pastorName, contactPreference, contactPhone, contactEmail, email, phone } = data;

    const internalId = verifyAmendToken(token);
    if (!internalId) {
      return NextResponse.json({ error: "This session has expired. Please look up your registration again." }, { status: 401 });
    }

    const registration = await prisma.registration.findUnique({ where: { id: internalId } });
    if (!registration) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }
    if (registration.paymentStatus === "CANCELLED") {
      return NextResponse.json({ error: "This registration has been cancelled." }, { status: 409 });
    }

    const headcountLocked = registration.paymentStatus === "COMPLETED";
    const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === registration.category);

    // Contact-detail fields — always editable.
    const contactUpdates: Record<string, unknown> = {};
    if (registrarName !== undefined) contactUpdates.registrarName = registrarName || null;
    if (contactPreference !== undefined) contactUpdates.contactPreference = contactPreference || null;
    if (contactPhone !== undefined) contactUpdates.contactPhone = contactPhone || null;
    if (contactEmail !== undefined) contactUpdates.contactEmail = contactEmail || null;
    if (email !== undefined && email) contactUpdates.email = email;
    if (phone !== undefined) contactUpdates.phone = phone || null;
    if (pastorName !== undefined) {
      contactUpdates.formData = { ...(registration.formData as any), pastorName: pastorName || null };
    }

    // Headcount fields — locked post-payment.
    const wantsHeadcountChange =
      data.adults !== undefined || data.youth !== undefined || data.kids !== undefined || data.numberOfTickets !== undefined;

    if (wantsHeadcountChange && headcountLocked) {
      return NextResponse.json(
        { error: "This registration is already paid, so headcounts can't be changed here — contact the event team for adjustments." },
        { status: 409 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const headcountUpdates: Record<string, unknown> = {};

      if (wantsHeadcountChange && registration.type === "CHURCH") {
        const adults = Math.max(0, parseInt(String(data.adults ?? registration.adults), 10) || 0);
        const youth = Math.max(0, parseInt(String(data.youth ?? registration.youth), 10) || 0);
        const kids = Math.max(0, parseInt(String(data.kids ?? registration.kids), 10) || 0);
        const total = adults + youth + kids;

        if (total <= 0) throw new Error("VALIDATION: Attendee count must be greater than zero.");
        if (catInfo && total > catInfo.maxTicketsPerReg) {
          throw new Error(`VALIDATION: This exceeds the ${catInfo.maxTicketsPerReg.toLocaleString()} attendee limit for ${catInfo.name}.`);
        }

        if (catInfo) {
          const ticketQty = adults + youth; // kids don't receive tickets, matches original registration logic
          const currentTicketQty = registration.adults + registration.youth;
          const delta = ticketQty - currentTicketQty;
          if (delta > 0) {
            const activeRegs = await tx.registration.findMany({
              where: { category: registration.category, paymentStatus: { not: "CANCELLED" }, id: { not: registration.id } },
              select: { type: true, adults: true, youth: true, numberOfAttendees: true },
            });
            const reservedSeats = activeRegs.reduce(
              (sum, r) => sum + (r.type === "CHURCH" ? r.adults + r.youth : r.numberOfAttendees),
              0
            );
            const remaining = catInfo.ticketPool - reservedSeats - currentTicketQty;
            if (delta > remaining) {
              throw new Error(`VALIDATION: Only ${Math.max(0, remaining)} additional seat(s) remain in the ${catInfo.name} pool.`);
            }
          }
        }

        // Re-split across venues for the new counts — release what was there
        // and recompute from scratch rather than trying to patch deltas per
        // venue, since a shrink can free up room a growth elsewhere needs.
        await releaseVenueAllocations(tx, registration.id);
        const { allocations } = await autoAssignVenues(tx, registration.eventId, { adults, youth, kids });
        await applyVenueAllocations(tx, registration.id, allocations);

        Object.assign(headcountUpdates, { adults, youth, kids, numberOfAttendees: total });
      }

      if (wantsHeadcountChange && registration.type === "INDIVIDUAL") {
        const numberOfTickets = Math.max(1, parseInt(String(data.numberOfTickets), 10) || 1);
        if (catInfo && numberOfTickets > catInfo.maxTicketsPerReg) {
          throw new Error(`VALIDATION: This exceeds the ${catInfo.maxTicketsPerReg.toLocaleString()} ticket limit for ${catInfo.name}.`);
        }

        if (catInfo) {
          const delta = numberOfTickets - registration.numberOfAttendees;
          if (delta > 0) {
            const activeRegs = await tx.registration.findMany({
              where: { category: registration.category, paymentStatus: { not: "CANCELLED" }, id: { not: registration.id } },
              select: { type: true, adults: true, youth: true, numberOfAttendees: true },
            });
            const reservedSeats = activeRegs.reduce(
              (sum, r) => sum + (r.type === "CHURCH" ? r.adults + r.youth : r.numberOfAttendees),
              0
            );
            const remaining = catInfo.ticketPool - reservedSeats - registration.numberOfAttendees;
            if (delta > remaining) {
              throw new Error(`VALIDATION: Only ${Math.max(0, remaining)} additional seat(s) remain in the ${catInfo.name} pool.`);
            }
          }
        }

        Object.assign(headcountUpdates, {
          numberOfAttendees: numberOfTickets,
          fee: catInfo ? catInfo.fee * numberOfTickets : registration.fee,
        });
      }

      return tx.registration.update({
        where: { id: registration.id },
        data: { ...contactUpdates, ...headcountUpdates },
      });
    });

    return NextResponse.json({
      success: true,
      registrationId: result.registrationId,
      adults: result.adults,
      youth: result.youth,
      kids: result.kids,
      numberOfTickets: result.numberOfAttendees,
      fee: result.fee,
    });
  } catch (error: any) {
    console.error("Amend registration error:", error);
    if (error.message?.startsWith("VALIDATION:")) {
      return NextResponse.json({ error: error.message.replace(/^VALIDATION: /, "") }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not save your changes. Please try again." }, { status: 500 });
  }
}
