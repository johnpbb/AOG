import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { isRegistrationOnly } from "@/lib/roles";

// Resolves the currently logged-in staff member from the signed session
// cookie. Use in admin API routes that need to attribute an action to a
// real person (e.g. "Confirmed by: [Name]" on a payment entry).
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) return null;
  // The middleware gates routes by the role in the signed cookie. If a super
  // admin has since changed this person's role, the cookie is stale: treat
  // it as signed out so they log in again and pick up the new permissions.
  if (session.role !== user.role) return null;

  return user;
}

// For write routes outside /api/admin that only full staff may use (events,
// venues, uploads). Returns an error response to send back, or null if the
// caller is a signed-in staff member other than Registration Desk.
export async function requireFullStaff(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isRegistrationOnly(user.role)) {
    return NextResponse.json(
      { error: "Your account only has access to registrations and amendments" },
      { status: 403 }
    );
  }
  return null;
}
