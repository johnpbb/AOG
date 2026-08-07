import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifyAmendToken } from "@/lib/amend-token";
import { REGISTRATION_CATEGORIES } from "@/lib/types";
import { autoAssignVenues, applyVenueAllocations, releaseVenueAllocations } from "@/lib/venue-assignment";
import { checkCategoryCapacity, RegistrationCapacityError } from "@/lib/create-registration";

// POST /api/register/amend — the write side of the public self-amend flow.
// Requires a token minted by /api/register/lookup (proves the registrant
// already passed the code+contact check) rather than accepting raw contact
// info again, so this isn't a second guessable auth surface.
//
// Contact-detail fields are always editable. Headcount fields (adults/
// youth/kids — every registration type tracks these now) are locked once
// payment is COMPLETED — a genuine post-payment headcount change goes
// through admin/finance manually, per the confirmed product decision.
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

      if (wantsHeadcountChange) {
        const adults = Math.max(0, parseInt(String(data.adults ?? registration.adults), 10) || 0);
        const youth = Math.max(0, parseInt(String(data.youth ?? registration.youth), 10) || 0);
        const kids = Math.max(0, parseInt(String(data.kids ?? registration.kids), 10) || 0);
        const total = adults + youth + kids;

        if (total <= 0) throw new Error("VALIDATION: Attendee count must be greater than zero.");

        if (catInfo) {
          try {
            await checkCategoryCapacity(tx, catInfo, { adults, youth, kids }, registration.id);
          } catch (err) {
            if (err instanceof RegistrationCapacityError) throw new Error(`VALIDATION: ${err.message}`);
            throw err;
          }
        }

        // Re-split across venues for the new counts — release what was there
        // and recompute from scratch rather than trying to patch deltas per
        // venue, since a shrink can free up room a growth elsewhere needs.
        // Throwing here rolls back the release too, since it's all inside
        // this same transaction — the prior allocation is left untouched.
        await releaseVenueAllocations(tx, registration.id);
        const { allocations, warnings } = await autoAssignVenues(tx, registration.eventId, { adults, youth, kids });
        if (warnings.length > 0) {
          throw new Error("VALIDATION: This would exceed venue capacity. Please contact the event team for adjustments.");
        }
        await applyVenueAllocations(tx, registration.id, allocations);

        Object.assign(headcountUpdates, {
          adults,
          youth,
          kids,
          numberOfAttendees: total,
          ...(registration.type === "INDIVIDUAL" && catInfo ? { fee: catInfo.fee * total } : {}),
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
