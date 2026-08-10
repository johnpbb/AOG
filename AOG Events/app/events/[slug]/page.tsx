import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ArrowRight, ArrowLeft, MapPin, Users, Building2 } from "lucide-react";
import { EventScheduleTabs } from "@/components/event-schedule-tabs";

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
    <div className="bg-brand-black text-brand-white min-h-screen">

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="brand-nav fixed">
        <div className="max-w-[1280px] mx-auto px-6 flex items-center justify-between h-[68px]">
          <Link href="/">
            <Image src="/logos/agfj100-light.png" alt="Assemblies of God" width={52} height={52} className="object-contain" priority />
          </Link>
          <Link
            href={`/events/${slug}/register`}
            className="inline-flex items-center gap-2 bg-brand-orange text-brand-white px-[22px] py-[10px] rounded-lg font-bold text-sm no-underline tracking-[0.03em]"
          >
            Register Now <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      {/* ── BANNER ──────────────────────────────────────────────────────────── */}
      {event.bannerUrl ? (
        <div className="relative h-[380px] overflow-hidden">
          <Image src={event.bannerUrl} alt={event.name} fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-10 pb-9">
            <div className="max-w-[1200px] mx-auto">
              <h1 className="text-[clamp(28px,4vw,48px)] font-extrabold text-brand-white leading-[1.35] font-boldonse">
                {event.name}
              </h1>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-[260px] tapa-bg relative flex items-center">
          <div className="absolute inset-0 bg-black/55" />
          <div className="max-w-[1200px] mx-auto px-10 relative z-10">
            <h1 className="text-[clamp(28px,4vw,48px)] font-extrabold text-brand-white leading-[1.35] font-boldonse">
              {event.name}
            </h1>
          </div>
        </div>
      )}

      {/* ── CONTENT ─────────────────────────────────────────────────────────── */}
      <div className="max-w-[1200px] mx-auto px-5 sm:px-10 py-12 pb-20">

        <Link href="/" className="inline-flex items-center gap-1.5 text-white/45 text-[13px] no-underline mb-10">
          <ArrowLeft size={14} /> All Events
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 items-start">

          {/* ── Main ────────────────────────────────────────────────────────── */}
          <div>
            <EventScheduleTabs />

            {event.venues.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-brand-white mb-5">Venues</h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                  {event.venues.map((venue) => {
                    const vPct = venue.capacity > 0
                      ? Math.round((venue.currentRegistrations / venue.capacity) * 100)
                      : 0;
                    return (
                      <div key={venue.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 size={15} color="var(--brand-orange)" />
                          <span className="font-semibold text-[15px] text-brand-white">{venue.name}</span>
                        </div>
                        {venue.city && (
                          <p className="text-[13px] text-white/45 flex items-center gap-1 mb-3">
                            <MapPin size={12} />
                            {venue.city}{venue.address && ` — ${venue.address}`}
                          </p>
                        )}
                        <div className="flex justify-between text-xs text-white/40 mb-1.5">
                          <span>{venue.currentRegistrations.toLocaleString()} / {venue.capacity.toLocaleString()}</span>
                          <span>{vPct}%</span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-sm overflow-hidden">
                          <div
                            className={`h-full rounded-sm transition-[width] duration-[400ms] ease-in-out ${vPct >= 100 ? "bg-red-500" : vPct >= 80 ? "bg-amber-500" : "bg-brand-orange"}`}
                            style={{ width: `${Math.min(vPct, 100)}%` }}
                          />
                        </div>
                        {venue.description && (
                          <p className="text-xs text-white/35 mt-2.5">{venue.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar CTA ─────────────────────────────────────────────────── */}
          <div className="lg:sticky lg:top-[92px]">
            <div className="bg-white/[0.04] border border-brand-orange/20 rounded-2xl p-7 text-center">
              <h2 className="text-lg font-bold text-brand-white mb-2">Reserve Your Place</h2>

              {totalCapacity > 0 && (
                <>
                  <p className="text-sm text-white/50 flex items-center justify-center gap-1.5 mb-3">
                    <Users size={13} color="var(--brand-orange)" />
                    {seatsLeft > 0 ? `${seatsLeft.toLocaleString()} seats remaining` : "Fully booked"}
                  </p>
                  <div className="h-1 bg-white/10 rounded-sm overflow-hidden mb-6">
                    <div
                      className={`h-full rounded-sm ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-brand-orange"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </>
              )}

              <Link
                href={`/events/${slug}/register`}
                className="flex items-center justify-center gap-2 bg-brand-orange text-brand-white px-5 py-[13px] rounded-lg font-bold text-sm no-underline tracking-[0.02em]"
              >
                Register Now <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-[#050505] border-t border-brand-orange/12 py-[44px] px-6">
        <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-5 text-center">
          <Image src="/logos/agfj100-dark.png" alt="Assemblies of God" width={42} height={42} className="object-contain opacity-70" />
          <p className="text-xs text-white/30">© 2026 Assemblies of God, Fiji. All rights reserved.</p>
          <div className="flex gap-7 text-[13px]">
            <Link href="/admin" className="text-white/35 no-underline">Admin</Link>
            <span className="text-white/[0.18]">·</span>
            <span className="text-white/25">Powered by VaizeePay</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
