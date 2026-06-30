import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

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

  return user;
}
