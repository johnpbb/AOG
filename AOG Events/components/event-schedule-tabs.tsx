"use client";

import { useState } from "react";
import {
  MapPin,
  Sun,
  Moon,
  Users,
  PartyPopper,
  ClipboardCheck,
  Palette,
  Coffee,
  HandHeart,
  BookOpen,
  Church,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

interface ScheduleSession {
  icon: LucideIcon;
  title: string;
  time?: string;
  venue: string;
  note?: string;
}

interface ScheduleDay {
  id: string;
  tabLabel: string;
  fullLabel: string;
  dayNote?: string;
  sessions: ScheduleSession[];
}

const SCHEDULE: ScheduleDay[] = [
  {
    id: "mon7",
    tabLabel: "Mon, 7 Dec",
    fullLabel: "Monday, 7 December",
    sessions: [
      { icon: ClipboardCheck, title: "Registration Check-ins", time: "8am – 2pm", venue: "Mount Zion Cathedral, Saru" },
      { icon: Sun, title: "WM & Men’s Day", time: "9am – 1pm", venue: "Mount Zion Cathedral, Saru" },
      { icon: Moon, title: "Evening Rally", time: "From 6:30pm", venue: "Churchill Park, Lautoka" },
    ],
  },
  {
    id: "tue8-fri11",
    tabLabel: "Tue 8 – Fri 11 Dec",
    fullLabel: "Tuesday, 8 December – Friday, 11 December",
    sessions: [
      {
        icon: Coffee,
        title: "Missions Breakfast",
        time: "6am",
        venue: "Sheraton Fiji Golf & Beach Resort, Denarau",
      },
      { icon: Sun, title: "Adults Program", time: "9am – 2pm", venue: "Mount Zion Cathedral, Saru" },
      { icon: Users, title: "NextGen & NextGen Kids Program", time: "9am – 3pm", venue: "Churchill Park, Lautoka" },
      {
        icon: Palette,
        title: "NextGen Fine Arts",
        time: "9am – 3pm",
        venue: "Churchill Park, Lautoka",
        note: "Thursday & Friday only",
      },
      {
        icon: HandHeart,
        title: "SPBC Prayer Breakfast",
        time: "6am",
        venue: "Tanoa Waterfront Hotel, Lautoka",
        note: "Thursday only",
      },
      {
        icon: BookOpen,
        title: "Fire Bible Launch",
        venue: "Churchill Park, Lautoka",
        note: "Friday only",
      },
      { icon: Moon, title: "Evening Rally", time: "From 6:30pm", venue: "Churchill Park, Lautoka" },
    ],
  },
  {
    id: "sat12",
    tabLabel: "Sat, 12 Dec",
    fullLabel: "Saturday, 12 December",
    sessions: [
      { icon: Users, title: "NextGen Program", time: "9am – 1pm", venue: "Churchill Park, Lautoka" },
      {
        icon: PartyPopper,
        title: "Dinner Celebrations",
        time: "4pm",
        venue: "Sheraton Fiji Golf & Beach Resort, Denarau",
      },
    ],
  },
  {
    id: "sun13",
    tabLabel: "Sun, 13 Dec",
    fullLabel: "Sunday, 13 December",
    sessions: [
      { icon: Church, title: "Join a local AOG church for services", time: "10am", venue: "Any local AOG church" },
      { icon: Megaphone, title: "Closing Rally", time: "3pm", venue: "Churchill Park, Lautoka" },
    ],
  },
];

export function EventScheduleTabs() {
  const [active, setActive] = useState(0);
  const day = SCHEDULE[active];

  return (
    <div className="mb-12">
      <h2 className="text-xl font-bold text-brand-white mb-5">Event Schedule</h2>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Day tabs */}
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 lg:w-[210px] shrink-0 -mx-1 px-1 lg:mx-0 lg:px-0">
          {SCHEDULE.map((d, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setActive(i)}
              className={`shrink-0 lg:shrink text-left px-4 py-3 rounded-lg border whitespace-nowrap lg:whitespace-normal transition-colors cursor-pointer ${
                active === i
                  ? "bg-brand-orange/10 border-brand-orange"
                  : "bg-white/[0.03] border-white/10 hover:border-white/25"
              }`}
            >
              <div
                className={`text-[10px] uppercase tracking-wide font-semibold mb-0.5 ${
                  active === i ? "text-brand-orange" : "text-white/35"
                }`}
              >
                Day {i + 1}
              </div>
              <div className={`text-sm font-bold ${active === i ? "text-brand-white" : "text-white/60"}`}>
                {d.tabLabel}
              </div>
            </button>
          ))}
        </div>

        {/* Session detail */}
        <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl p-6 min-w-0">
          <h3 className="text-base font-bold text-brand-white mb-1">{day.fullLabel}</h3>
          {day.dayNote && <p className="text-xs text-white/40 italic mb-4">{day.dayNote}</p>}
          {!day.dayNote && <div className="mb-4" />}

          <div className="flex flex-col divide-y divide-white/[0.06]">
            {day.sessions.map((s, idx) => (
              <div key={idx} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                <div className="w-9 h-9 rounded-full bg-brand-orange/12 flex items-center justify-center shrink-0">
                  <s.icon size={16} color="var(--brand-orange)" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold text-brand-white">{s.title}</p>
                    {s.time && <span className="text-xs text-brand-orange font-medium">{s.time}</span>}
                  </div>
                  <p className="text-[13px] text-white/45 mt-1 flex items-center gap-1">
                    <MapPin size={11} className="shrink-0" />
                    {s.venue}
                  </p>
                  {s.note && <p className="text-xs text-white/35 mt-1 italic">{s.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
