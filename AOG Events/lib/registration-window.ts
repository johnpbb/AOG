import { prisma } from "@/lib/prisma";

// Public registration close. Stored on SiteConfig.registrationClosesAt and
// edited from Admin → Settings (entered in Fiji time). Only the public
// conference form is gated: logged-in staff bypass it so they can still
// register people, and gala dinner bookings are never gated by it.

export const FIJI_UTC_OFFSET = "+12:00"; // Fiji has observed no DST since 2022.

export async function getRegistrationClosesAt(): Promise<Date | null> {
  const config = await prisma.siteConfig.findUnique({
    where: { id: "default" },
    select: { registrationClosesAt: true },
  });
  return config?.registrationClosesAt ?? null;
}

export function isClosed(closesAt: Date | null, now: Date = new Date()): boolean {
  return closesAt !== null && now.getTime() >= closesAt.getTime();
}

export async function isPublicRegistrationClosed(): Promise<boolean> {
  return isClosed(await getRegistrationClosesAt());
}

export function formatFijiDateTime(d: Date): string {
  return d.toLocaleString("en-FJ", {
    timeZone: "Pacific/Fiji",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const REGISTRATION_CLOSED_MESSAGE =
  "Registration for this event is now closed. If you have already paid and need help with your registration, please contact the AG Fiji office.";
