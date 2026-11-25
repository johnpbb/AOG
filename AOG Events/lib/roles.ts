// Staff role definitions shared by the middleware (server-side enforcement)
// and the admin UI (which views/actions to show). No Prisma or Node imports
// here so it can be used from client components.

export type StaffRole = "SUPER_ADMIN" | "ADMIN" | "FINANCE" | "REGISTRATION";

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  FINANCE: "Finance",
  REGISTRATION: "Registration Desk",
};

// Order shown in the staff-account role pickers.
export const STAFF_ROLE_OPTIONS: StaffRole[] = ["REGISTRATION", "FINANCE", "ADMIN", "SUPER_ADMIN"];

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && value in STAFF_ROLE_LABELS;
}

// Registration Desk staff may only view registrations, register people (the
// public form while logged in, or CSV import) and amend existing
// registrations. No approvals, cancellations, payments, finance, events,
// venues, check-in, settings or staff management.
export function isRegistrationOnly(role: string | null | undefined): boolean {
  return role === "REGISTRATION";
}

// API routes a Registration Desk session may call under /api/admin. Anything
// else under /api/admin is refused by the middleware for that role.
const REGISTRATION_ADMIN_API: { method: string | "*"; pattern: RegExp }[] = [
  { method: "*", pattern: /^\/api\/admin\/(login|logout|me|forgot-password|reset-password)$/ },
  { method: "GET", pattern: /^\/api\/admin\/registrations$/ },
  { method: "POST", pattern: /^\/api\/admin\/registrations\/[^/]+\/amend$/ },
  // Read-only payment history shown in the View Details dialog.
  { method: "GET", pattern: /^\/api\/admin\/registrations\/[^/]+\/payments$/ },
  { method: "*", pattern: /^\/api\/admin\/registrations\/import\/(template|validate|commit)$/ },
];

export function registrationRoleMayCall(method: string, pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  return REGISTRATION_ADMIN_API.some(
    (rule) => (rule.method === "*" || rule.method === method.toUpperCase()) && rule.pattern.test(path)
  );
}
