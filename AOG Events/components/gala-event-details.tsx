import { CalendarDays, Clock, MapPin, Shirt, Armchair, Users, Mail, Phone } from "lucide-react";
import { GALA_DETAILS, REGISTRATION_CATEGORIES } from "@/lib/types";

// The gala's counterpart to EventScheduleTabs. The conference page fills its
// main column with a 7-day programme; a single-evening dinner instead needs
// the facts someone decides on before buying — when, where, what to wear and
// what it costs. Prices are read from the categories so this page and the
// booking form can't quote different numbers.
const seatFee = REGISTRATION_CATEGORIES.find((c) => c.id === "gala-seat")?.fee ?? 0;
const tableFee = REGISTRATION_CATEGORIES.find((c) => c.id === "gala-table")?.fee ?? 0;

const FACTS = [
  { icon: CalendarDays, label: "Date", value: GALA_DETAILS.dateLabel },
  { icon: Clock, label: "Time", value: GALA_DETAILS.timeLabel },
  { icon: MapPin, label: "Venue", value: GALA_DETAILS.venueName },
  { icon: Shirt, label: "Dress code", value: GALA_DETAILS.dressCode },
];

const TIERS = [
  { icon: Armchair, title: "Individual Seat", price: seatFee, per: "per person" },
  { icon: Users, title: "Table of 10", price: tableFee, per: "per table of 10 seats" },
];

export function GalaEventDetails() {
  return (
    <div className="mb-12">
      <h2 className="text-xl font-bold text-brand-white mb-5">Event Details</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-9">
        {FACTS.map((f) => (
          <div key={f.label} className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-start gap-3.5">
            <div className="h-9 w-9 shrink-0 rounded-full bg-brand-orange/12 flex items-center justify-center">
              <f.icon size={16} color="var(--brand-orange)" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-white/35 mb-1">{f.label}</p>
              <p className="text-[15px] font-semibold text-brand-white leading-snug">{f.value}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-brand-white mb-5">Tickets</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {TIERS.map((t) => (
          <div key={t.title} className="bg-white/5 border border-brand-orange/20 rounded-xl p-6">
            <t.icon size={18} color="var(--brand-orange)" />
            <p className="text-[15px] font-semibold text-brand-white mt-3">{t.title}</p>
            <p className="text-[26px] font-extrabold text-brand-orange leading-tight mt-1.5">
              ${t.price.toLocaleString()} <span className="text-[13px] font-bold align-middle">FJD</span>
            </p>
            <p className="text-[13px] text-white/40 mt-0.5">{t.per}</p>
          </div>
        ))}
      </div>

      <p className="text-[13px] text-white/45 leading-relaxed mb-12">
        Celebrating 100 years of God&apos;s faithfulness in the Assemblies of God, Fiji — honoring the past,
        embracing the present and sowing seeds for the future.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-7 text-[13px] text-white/45">
        <span className="text-white/30 font-semibold tracking-[0.1em] uppercase text-[11px]">Enquiries</span>
        <a href={`mailto:${GALA_DETAILS.enquiriesEmail}`} className="inline-flex items-center gap-2 text-white/60 no-underline">
          <Mail size={13} color="var(--brand-orange)" /> {GALA_DETAILS.enquiriesEmail}
        </a>
        <a href={`tel:${GALA_DETAILS.enquiriesPhone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-white/60 no-underline">
          <Phone size={13} color="var(--brand-orange)" /> {GALA_DETAILS.enquiriesPhone}
        </a>
      </div>
    </div>
  );
}
