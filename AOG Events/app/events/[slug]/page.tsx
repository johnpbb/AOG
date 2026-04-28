import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { prisma } from "@/lib/prisma";
import { ArrowRight, Calendar, MapPin, Users, Building2, Clock, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getEvent(slug: string) {
  return prisma.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      venues: true,
      _count: { select: { registrations: true } },
    },
  });
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) notFound();

  const totalCapacity = event.venues.reduce((s, v) => s + v.capacity, 0);
  const totalRegistered = event.venues.reduce((s, v) => s + v.currentRegistrations, 0);
  const pct = totalCapacity > 0 ? Math.round((totalRegistered / totalCapacity) * 100) : 0;
  const seatsLeft = totalCapacity - totalRegistered;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Banner */}
      {event.bannerUrl ? (
        <div className="relative h-64 md:h-96 overflow-hidden">
          <img src={event.bannerUrl} alt={event.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex items-end">
            <div className="container mx-auto px-4 pb-8">
              <h1 className="text-3xl md:text-5xl font-bold text-white">{event.name}</h1>
            </div>
          </div>
        </div>
      ) : (
        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:64px_64px]" />
          <div className="container mx-auto px-4 py-16 md:py-24 relative">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-primary-foreground/70 hover:text-primary-foreground mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              All Events
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold">{event.name}</h1>
          </div>
        </section>
      )}

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {event.bannerUrl && (
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All Events
          </Link>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {event.description && (
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-line">
                {event.description}
              </div>
            )}

            {/* Venues */}
            {event.venues.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">Venues</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {event.venues.map((venue) => {
                    const vPct = venue.capacity > 0
                      ? Math.round((venue.currentRegistrations / venue.capacity) * 100)
                      : 0;
                    return (
                      <div key={venue.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-medium text-foreground">{venue.name}</h3>
                        </div>
                        {venue.city && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {venue.city}
                            {venue.address && ` — ${venue.address}`}
                          </p>
                        )}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{venue.currentRegistrations.toLocaleString()} / {venue.capacity.toLocaleString()} registered</span>
                            <span>{vPct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className={`h-full rounded-full ${vPct >= 100 ? "bg-red-500" : vPct >= 80 ? "bg-yellow-500" : "bg-green-500"}`}
                              style={{ width: `${Math.min(vPct, 100)}%` }}
                            />
                          </div>
                        </div>
                        {venue.description && (
                          <p className="text-xs text-muted-foreground">{venue.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Event info card */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="font-semibold text-foreground">Event Details</h2>

              {event.startDate && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {format(new Date(event.startDate), "EEEE, d MMMM yyyy")}
                    </p>
                    {event.endDate && (
                      <p className="text-xs text-muted-foreground">
                        to {format(new Date(event.endDate), "d MMMM yyyy")}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {event.startDate && (
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-foreground">
                    {format(new Date(event.startDate), "h:mm a")}
                  </p>
                </div>
              )}

              {event.location && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-foreground">{event.location}</p>
                </div>
              )}

              {totalCapacity > 0 && (
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-foreground">
                      {seatsLeft > 0
                        ? `${seatsLeft.toLocaleString()} seats available`
                        : "Fully booked"}
                    </p>
                    <p className="text-xs text-muted-foreground">{pct}% capacity</p>
                  </div>
                </div>
              )}

              <Link
                href={`/events/${slug}/register`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Register Now
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <footer className="py-10 border-t border-border mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © AOG Fiji Events · Powered by VaizeePay
        </div>
      </footer>
    </div>
  );
}
