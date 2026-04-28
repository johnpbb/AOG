import Link from "next/link";
import { Header } from "@/components/header";
import { ArrowRight, Calendar, MapPin, Users, Building2, Globe, Star, CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

// Force dynamic so we always fetch fresh events
export const dynamic = "force-dynamic";

async function getPublishedEvents() {
  try {
    return await prisma.event.findMany({
      where: { status: "PUBLISHED" },
      include: {
        venues: { select: { id: true, name: true, city: true, capacity: true, currentRegistrations: true } },
        _count: { select: { registrations: true } },
      },
      orderBy: { startDate: "asc" },
    });
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const events = await getPublishedEvents();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="container mx-auto px-4 py-24 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 text-sm font-medium mb-6">
              <CalendarDays className="h-4 w-4" />
              <span>AOG Fiji Events Platform</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance">
              AOG Fiji Events
            </h1>
            <p className="mt-6 text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto text-pretty">
              The official platform for Assemblies of God Fiji events — discover, register, and
              participate in gatherings of faith across the Pacific.
            </p>
          </div>
        </div>
      </section>

      {/* Events Listing */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Upcoming Events</h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Register for AOG Fiji events below
            </p>
          </div>

          {events.length === 0 ? (
            <div className="max-w-md mx-auto text-center py-16">
              <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                <CalendarDays className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground text-xl">No Events Yet</h3>
              <p className="mt-2 text-muted-foreground">
                Check back soon — events will appear here when they are published.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {events.map((event) => {
                const totalCapacity = event.venues.reduce((s, v) => s + v.capacity, 0);
                const totalRegistered = event.venues.reduce((s, v) => s + v.currentRegistrations, 0);
                const pct = totalCapacity > 0 ? Math.round((totalRegistered / totalCapacity) * 100) : 0;

                return (
                  <div
                    key={event.id}
                    className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all group"
                  >
                    {/* Banner */}
                    {event.bannerUrl ? (
                      <div className="h-44 overflow-hidden">
                        <img
                          src={event.bannerUrl}
                          alt={event.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="h-44 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <CalendarDays className="h-14 w-14 text-primary/30" />
                      </div>
                    )}

                    <div className="p-5 space-y-3">
                      <h3 className="font-bold text-foreground text-lg leading-tight">{event.name}</h3>

                      {event.shortDesc && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{event.shortDesc}</p>
                      )}

                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {event.startDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(event.startDate), "d MMM yyyy")}
                          </span>
                        )}
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.location}
                          </span>
                        )}
                        {event.venues.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {event.venues.length} venue{event.venues.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Capacity bar */}
                      {totalCapacity > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {totalRegistered.toLocaleString()} registered
                            </span>
                            <span>{pct}% full</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-green-500"
                              }`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <Link
                        href={`/events/${event.slug}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 mt-1"
                      >
                        View & Register
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                AOG
              </div>
              <span className="text-sm text-muted-foreground">AOG Fiji Events Platform</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/admin" className="hover:text-foreground transition-colors">
                Admin
              </Link>
              <span>Powered by VaizeePay</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
