import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendRegistrationTickets } from "@/lib/send-registration-tickets";

// POST /api/admin/registrations/[id]/resend-tickets — emails the current
// ACTIVE ticket pack for one fully paid registration. Used by the "Resend
// tickets" menu item and, one registration per call, by the bulk reissue
// screen (so a long run never hits a request timeout and every row reports
// its own result). Not on the Registration Desk allowlist in lib/roles.ts.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const outcome = await sendRegistrationTickets(id);
  return NextResponse.json(outcome);
}
