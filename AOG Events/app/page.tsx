import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Calendar, MapPin, Users, Building2, ChevronDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { HeroSlider } from "@/components/hero-slider";

const HERO_IMAGES = Array.from(
  { length: 10 },
  (_, i) => `/images/hero/AG100-2026-${i + 1}.webp`
);

export const dynamic = "force-dynamic";

async function getPublishedEvents() {
  try {
    return await prisma.event.findMany({
      where: { status: "PUBLISHED" },
      include: {
        venues: {
          select: { id: true, name: true, city: true, capacity: true, currentRegistrations: true },
        },
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
  const primaryEventHref = events.length === 1 ? `/events/${events[0].slug}` : "/events";

  return (
    <div className="bg-brand-black text-brand-white overflow-x-hidden">

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="brand-nav fixed">
        <div className="max-w-[1280px] mx-auto px-6 flex items-center justify-between h-[68px]">
          <Image src="/logos/agfj100-light.png" alt="Assemblies of God" width={52} height={52} className="object-contain" priority />
          <Link href={primaryEventHref} className="inline-flex items-center gap-2 bg-brand-orange text-brand-white px-[22px] py-[10px] rounded-lg font-bold text-sm no-underline tracking-[0.03em]">
            Register Now <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="min-h-screen bg-brand-black flex items-center relative overflow-hidden">
        <HeroSlider images={HERO_IMAGES} />
        <div className="absolute inset-0 brand-hero-glow pointer-events-none" />

        <div className="max-w-[820px] mx-auto px-6 sm:px-10 md:px-16 lg:px-[100px] pt-[120px] pb-[100px] text-center relative z-10">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-white/45 mb-8">
            Assemblies of God · Fiji · Est. 1926
          </p>
          <div className="mb-8">
            <Image
              src="/logos/agfj100-light.png"
              alt="Assemblies of God"
              width={220}
              height={220}
              className="object-contain mx-auto"
              priority
            />
          </div>
          <p className="text-[clamp(15px,2.2vw,20px)] text-white/60 leading-[1.7] max-w-[520px] mx-auto mb-[52px]">
            Join us in celebrating 100 years of Spirit-led mission across the Pacific islands
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href={primaryEventHref} className="inline-flex items-center gap-[10px] bg-brand-orange text-brand-white px-10 py-[15px] rounded-lg font-bold text-[15px] no-underline tracking-[0.04em]">
              View Events <ArrowRight size={17} />
            </Link>
            <a href="#about" className="inline-flex items-center gap-[10px] bg-transparent text-white/80 px-10 py-[15px] rounded-lg font-semibold text-[15px] no-underline border border-white/18">
              Our Story
            </a>
          </div>
        </div>

        <div className="absolute bottom-9 left-1/2 -translate-x-1/2 text-white/30 flex flex-col items-center gap-1.5">
          <span className="text-[10px] tracking-[0.2em] uppercase">Scroll</span>
          <ChevronDown size={14} />
        </div>
      </section>

      {/* ── STATS STRIP ─────────────────────────────────────────────────────── */}
      <section className="brand-stats-gradient py-[52px] px-6">
        <div className="max-w-[960px] mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { number: "100", label: "Years of Faith" },
            { number: "385+", label: "Churches" },
            { number: "1926", label: "Founded in Fiji" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-[clamp(40px,7vw,72px)] font-extrabold text-brand-black leading-none font-boldonse tracking-[-0.02em]">
                {stat.number}
              </div>
              <div className="text-xs font-bold text-black/65 mt-[10px] tracking-[0.18em] uppercase">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── EVENTS ──────────────────────────────────────────────────────────── */}
      <section id="events" className="bg-[#f9f8f6] py-[100px] px-6">
        <div className="max-w-[1200px] mx-auto">

          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-[0.22em] uppercase text-brand-orange mb-[14px]">
              Join The Celebration
            </p>
            <h2 className="text-[clamp(32px,5vw,54px)] font-extrabold text-brand-black leading-[1.3] font-boldonse">
              Upcoming Events
            </h2>
            <p className="mt-4 text-[17px] text-[#666] max-w-[520px] mx-auto leading-[1.7]">
              Discover what&apos;s next and register for events happening near you.
            </p>
          </div>

          {events.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-[#FFF0E5] rounded-[20px] flex items-center justify-center mx-auto mb-6 text-[36px]">
                🕊️
              </div>
              <h3 className="text-xl font-bold text-brand-black mb-2">Events Coming Soon</h3>
              <p className="text-[#999]">Check back soon — events will appear here when published.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-7">
              {events.map((event) => {
                const totalCapacity = event.venues.reduce((s, v) => s + v.capacity, 0);
                const totalRegistered = event.venues.reduce((s, v) => s + v.currentRegistrations, 0);
                const pct = totalCapacity > 0 ? Math.round((totalRegistered / totalCapacity) * 100) : 0;

                return (
                  <div key={event.id} className="bg-brand-white rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.07)] border border-black/[0.06] flex flex-col">
                    {event.bannerUrl ? (
                      <div className="relative h-[200px] overflow-hidden shrink-0">
                        <Image src={event.bannerUrl} alt={event.name} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="h-[200px] shrink-0 tapa-bg flex items-center justify-center">
                        <div className="bg-black/45 rounded-xl px-6 py-3">
                          <span className="text-[22px] font-extrabold text-brand-white font-boldonse tracking-[0.05em]">
                            AGFJ100
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="text-[19px] font-bold text-brand-black mb-2 leading-[1.3]">
                        {event.name}
                      </h3>

                      {event.shortDesc && (
                        <p className="text-sm text-[#666] leading-[1.65] mb-4">{event.shortDesc}</p>
                      )}

                      <div className="flex flex-wrap gap-3 mb-4">
                        {event.startDate && (
                          <span className="flex items-center gap-1.5 text-[13px] text-[#555]">
                            <Calendar size={13} color="var(--brand-orange)" />
                            {format(new Date(event.startDate), "d MMM yyyy")}
                          </span>
                        )}
                        {event.location && (
                          <span className="flex items-center gap-1.5 text-[13px] text-[#555]">
                            <MapPin size={13} color="var(--brand-orange)" />
                            {event.location}
                          </span>
                        )}
                        {event.venues.length > 0 && (
                          <span className="flex items-center gap-1.5 text-[13px] text-[#555]">
                            <Building2 size={13} color="var(--brand-orange)" />
                            {event.venues.length} venue{event.venues.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {totalCapacity > 0 && (
                        <div className="mb-5">
                          <div className="flex justify-between text-xs text-[#999] mb-1.5">
                            <span className="flex items-center gap-1">
                              <Users size={11} />
                              {totalRegistered.toLocaleString()} registered
                            </span>
                            <span>{pct}% full</span>
                          </div>
                          <div className="h-1 bg-[#f0f0f0] rounded-sm overflow-hidden">
                            <div
                              className={`h-full rounded-sm transition-[width] duration-[400ms] ease-in-out ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-brand-orange"}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <Link href={`/events/${event.slug}`} className="mt-auto flex items-center justify-center gap-2 bg-brand-orange text-brand-white px-5 py-3 rounded-lg font-bold text-sm no-underline tracking-[0.02em]">
                        View & Register <ArrowRight size={15} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {events.length > 0 && (
            <div className="text-center mt-14">
              <Link href="/events" className="inline-flex items-center gap-2 text-brand-orange font-semibold text-[15px] no-underline tracking-[0.02em]">
                Browse all events <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── ABOUT ───────────────────────────────────────────────────────────── */}
      <section id="about" className="bg-brand-black py-[100px] px-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 brand-gradient-lr" />
        <div className="absolute bottom-0 left-0 right-0 h-2 brand-gradient-rl" />
        <div className="absolute inset-0 brand-about-glow pointer-events-none" />

        <div className="max-w-[1024px] mx-auto text-center relative z-10">
          <p className="text-xs font-bold tracking-[0.22em] uppercase text-brand-orange mb-7">
            Our Journey
          </p>
          <h2 className="text-[clamp(28px,4.5vw,50px)] font-extrabold text-brand-white leading-[1.6] mb-7 font-boldonse">
            A Century of Spirit-Led Mission
          </h2>
          <p className="text-[18px] text-white/60 leading-[1.85] max-w-[620px] mx-auto mb-[52px]">
            Since 1926, the Assemblies of God Fiji has grown from humble beginnings
            to a movement of faith spanning 385+ churches across Fiji and the wider
            Pacific — a testament to God&apos;s faithfulness across generations.
          </p>
          <div className="inline-flex items-center gap-3 px-7 py-[14px] border border-brand-orange/35 rounded-lg text-white/70 text-[13px] font-medium tracking-[0.06em]">
            <span className="text-brand-orange font-bold">&ldquo;</span>
            As the Spirit enabled them
            <span className="text-brand-orange font-bold">&rdquo;</span>
            <span className="text-white/35 ml-1">— Acts 2:4</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-[#050505] border-t border-brand-orange/12 py-[44px] px-6">
        <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-5 text-center">
          <Image src="/logos/agfj100-dark.png" alt="Assemblies of God" width={42} height={42} className="object-contain opacity-70" />
          <p className="text-xs text-white/30">© 2026 Assemblies of God, Fiji. All rights reserved.</p>
          <div className="flex gap-7 text-[13px]">
            <Link href="/admin" className="text-white/35 no-underline">Admin</Link>
            {/* <span className="text-white/[0.18]">·</span>
            <span className="text-white/25">Powered by VaizeePay</span> */}
          </div>
        </div>
      </footer>
    </div>
  );
}
