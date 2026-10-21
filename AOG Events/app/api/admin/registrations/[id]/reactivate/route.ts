import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reactivateRegistration } from "@/lib/reactivate-registration";
import { RegistrationCapacityError, RegistrationValidationError } from "@/lib/create-registration";
import { VenueOversoldError } from "@/lib/venue-assignment";

// POST /api/admin/registrations/[id]/reactivate
// Brings a cancelled, unpaid registration back to PENDING with a fresh expiry
// window, re-claiming its venue seats. Refuses (409) rather than overselling.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const result = await prisma.$transaction((tx) => reactivateRegistration(tx, id));
    return NextResponse.json({
      success: true,
      message: `Registration ${result.registrationId} reactivated.`,
      ...result,
    });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }
    if (error.message === "NOT_CANCELLED") {
      return NextResponse.json({ error: "Only cancelled registrations can be reactivated" }, { status: 409 });
    }
    if (
      error instanceof RegistrationCapacityError ||
      error instanceof RegistrationValidationError ||
      error instanceof VenueOversoldError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Reactivate registration error:", error);
    return NextResponse.json({ error: "Failed to reactivate registration" }, { status: 500 });
  }
}
