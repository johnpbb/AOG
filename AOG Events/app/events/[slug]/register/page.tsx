import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { EventRegistrationClient } from "@/components/event-registration-client";
import { sanitizeRichText } from "@/lib/sanitize-html";

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

  const descriptionHtml = sanitizeRichText(event.description);

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
            <Image src="/logos/agfj100-light.png" alt="Assemblies of God" width={52} height={52} className="object-contain" priority />
          </Link>
        </div>
      </nav>

      {/* ── BANNER ──────────────────────────────────────────────────────────── */}
      {event.bannerUrl && (
        <div className="relative h-[220px] sm:h-[300px] overflow-hidden">
          <Image src={event.bannerUrl} alt={event.name} fill className="object-contain" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
        </div>
      )}

      {/* ── MAIN ────────────────────────────────────────────────────────────── */}
      <main className={event.bannerUrl ? "" : "pt-[68px]"}>
        <div className="max-w-[960px] mx-auto px-6 py-12 pb-20 -bg brand-white">

          <div className="mb-9">
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-brand-orange mb-2.5">
              Registration
            </p>
            <h1 className="text-[clamp(22px,3.5vw,34px)] font-extrabold text-brand-white leading-[1.35] font-boldonse mb-5">
              {event.name}
            </h1>
            {descriptionHtml && (
              <div className="prose-dark text-base" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
            )}
          </div>

          {/*
            The form components below (Input, Label, CategoryCard, Card, etc.) are
            styled with shadcn's light-theme CSS variables. This page's background is
            always dark, so without a `dark` ancestor those variables resolve to their
            light-mode values and produce invisible/near-invisible text (dark-on-black
            or white-on-white). Wrapping in `dark` flips every nested theme variable to
            its dark-mode pairing without touching this page's own brand-black chrome.
          */}
          <div className="dark">
            <EventRegistrationClient event={serializedEvent} />
          </div>
        </div>
      </main>

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
