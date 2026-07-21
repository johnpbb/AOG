import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// If there's exactly one published event, skip straight to it.
// Otherwise fall back to the homepage's events section, which lists all of them.
export default async function EventsPage() {
  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
  });

  if (events.length === 1) {
    redirect(`/events/${events[0].slug}`);
  }

  redirect("/#events");
}
