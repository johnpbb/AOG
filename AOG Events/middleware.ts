import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { isRegistrationOnly, registrationRoleMayCall } from "@/lib/roles";

// Public JSON APIs whose writes are admin-only (event/venue management and
// banner uploads). Reads stay public for the event pages.
const ADMIN_WRITE_APIS = ["/api/events", "/api/venues", "/api/upload"];

function forbidden(message: string, status = 403) {
  return NextResponse.json({ error: message }, { status });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  const publicAdminPaths = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];
  if (pathname.startsWith("/admin") && !publicAdminPaths.some((p) => pathname.startsWith(p))) {
    if (!session) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Registration Desk accounts only get the registration/amend endpoints.
  // Routes still check the user against the database themselves; this is
  // the role gate. (A stale cookie whose role no longer matches the DB is
  // rejected by getCurrentUser, so the cookie's role can be trusted here.)
  if (pathname.startsWith("/api/admin/")) {
    if (session && isRegistrationOnly(session.role) && !registrationRoleMayCall(method, pathname)) {
      return forbidden("Your account only has access to registrations and amendments");
    }
    return NextResponse.next();
  }

  if (ADMIN_WRITE_APIS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return NextResponse.next();
    if (!session) return forbidden("Unauthorized", 401);
    if (isRegistrationOnly(session.role)) {
      return forbidden("Your account only has access to registrations and amendments");
    }
  }

  return NextResponse.next();
}

export const runtime = "nodejs";

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/events/:path*",
    "/api/venues/:path*",
    "/api/upload/:path*",
  ],
};
