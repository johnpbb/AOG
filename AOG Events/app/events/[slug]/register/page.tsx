import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { EventRegistrationClient } from "@/components/event-registration-client";
import { ArrowLeft, ArrowRight } from "lucide-react";

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
    <div className="bg-brand-black text-brand-white min-h-screen">

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="brand-nav fixed">
        <div className="max-w-[1280px] mx-auto px-6 flex items-center justify-between h-[68px]">
          <Link href="/">
            <Image src="/logos/agfj100-light.png" alt="AGFJ100" width={160} height={48} className="object-contain" priority />
          </Link>
          <Link
            href={`/events/${slug}`}
            className="inline-flex items-center gap-2 text-white/60 text-[13px] no-underline font-medium"
          >
            <ArrowLeft size={14} /> Back to event
          </Link>
        </div>
      </nav>

      {/* ── MAIN ────────────────────────────────────────────────────────────── */}
      <main className="pt-[68px]">
        <div className="max-w-[960px] mx-auto px-6 py-12 pb-20 -bg brand-white">

          <Link
            href={`/events/${slug}`}
            className="inline-flex items-center gap-1.5 text-white/45 text-[13px] no-underline mb-8"
          >
            <ArrowLeft size={14} /> Back to {event.name}
          </Link>

          <div className="mb-9">
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-brand-orange mb-2.5">
              Registration
            </p>
            <h1 className="text-[clamp(22px,3.5vw,34px)] font-extrabold text-brand-white leading-[1.2] font-boldonse">
              {event.name}
            </h1>
          </div>

          <EventRegistrationClient event={serializedEvent} />
        </div>
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-[#050505] border-t border-brand-orange/12 py-[44px] px-6">
        <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-5 text-center">
          <Image src="/logos/agfj100-dark.png" alt="AGFJ100" width={130} height={42} className="object-contain opacity-70" />
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
