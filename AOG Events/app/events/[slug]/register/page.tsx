import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { prisma } from "@/lib/prisma";
import { EventRegistrationClient } from "@/components/event-registration-client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getEvent(slug: string) {
  return prisma.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      venues: {
        where: { isActive: true },
        orderBy: { name: "asc" },
      },
    },
  });
}

export default async function EventRegisterPage({ params }: Props) {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) notFound();

  // Serialize Date objects to strings for client component
  const serializedEvent = {
    id: event.id,
    name: event.name,
    slug: event.slug,
    location: event.location,
    startDate: event.startDate ? event.startDate.toISOString() : null,
    venues: event.venues.map((v) => ({
      id: v.id,
      name: v.name,
      city: v.city,
      address: v.address,
      capacity: v.capacity,
      currentRegistrations: v.currentRegistrations,
      isActive: v.isActive,
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          <Link
            href={`/events/${slug}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {event.name}
          </Link>

          <EventRegistrationClient event={serializedEvent} />
        </div>
      </main>
    </div>
  );
}
