export type RegistrationCategory =
  | "very-large-church"
  | "large-church"
  | "medium-church"
  | "small-church"
  | "individual"
  | "overseas"
  | "gala-seat"
  | "gala-table";

interface AgeCaps {
  adults: number;
  youth: number;
  kids: number;
}

export interface CategoryInfo {
  id: RegistrationCategory;
  name: string;
  description: string;
  type: "church" | "individual";
  icon: string;
  fee: number;
  // Max attendees of each type on a SINGLE registration — set for church-tier
  // categories, where the ceiling on total attendance is venue capacity, not
  // an aggregate pool (any number of churches may register within a tier).
  perRegCap: AgeCaps | null;
  // Aggregate cap shared across ALL registrations in the category — set for
  // Individual/Overseas instead of a per-registration cap.
  pool: AgeCaps | null;
  /**
   * Set when the category is sold in fixed blocks of seats rather than per
   * head — currently only the gala Table of 10, where `fee` is the price of
   * one whole block. Headcount is always seatsPerUnit x units, so the block
   * price and the seat count can't drift apart. Null means priced per head
   * (or flat per registration, for church tiers).
   */
  seatsPerUnit: number | null;
  /**
   * Code used in the reference number formula: AG100-{churchId}{categoryCode}{total}.
   * Spec only defined SM/MD/VL/OS/IN/MI — LG is our provisional extension for a
   * category the client's spec didn't anticipate. Pending client sign-off.
   */
  categoryCode: string;
}

export const REGISTRATION_CATEGORIES: CategoryInfo[] = [
  {
    id: "very-large-church",
    name: "Very Large Church",
    description: "Churches with 300+ members",
    type: "church",
    icon: "building",
    fee: 10000,
    perRegCap: { adults: 500, youth: 550, kids: 600 },
    pool: null,
    seatsPerUnit: null,
    categoryCode: "VL",
  },
  {
    id: "large-church",
    name: "Large Church",
    description: "Churches with 101-300 members",
    type: "church",
    icon: "building",
    fee: 5000,
    perRegCap: { adults: 110, youth: 100, kids: 55 },
    pool: null,
    seatsPerUnit: null,
    categoryCode: "LG",
  },
  {
    id: "medium-church",
    name: "Medium Church",
    description: "Churches with 51-100 members",
    type: "church",
    icon: "building",
    fee: 3000,
    perRegCap: { adults: 31, youth: 35, kids: 30 },
    pool: null,
    seatsPerUnit: null,
    categoryCode: "MD",
  },
  {
    id: "small-church",
    name: "Small Church",
    description: "Churches with 25-50 members",
    type: "church",
    icon: "building",
    fee: 1000,
    perRegCap: { adults: 15, youth: 15, kids: 20 },
    pool: null,
    seatsPerUnit: null,
    categoryCode: "SM",
  },
  {
    id: "individual",
    name: "Individual Attendee",
    description: "Personal registration — register yourself and up to 9 friends or family",
    type: "individual",
    icon: "user",
    fee: 100,
    perRegCap: null,
    pool: { adults: 1000, youth: 500, kids: 10 },
    seatsPerUnit: null,
    categoryCode: "IN",
  },
  {
    id: "overseas",
    name: "Overseas",
    description: "International guests attending from outside Fiji",
    type: "individual",
    icon: "globe",
    fee: 100, // Matches Individual Attendee rate for now, per client request — Master doc has no fee column.
    perRegCap: null,
    pool: { adults: 1000, youth: 500, kids: 100 },
    seatsPerUnit: null,
    categoryCode: "OS",
  },
  // ── Gala dinner ("The Journey") ──────────────────────────────────────────
  // A separate ticketed product on its own Event, not part of the AGFJ100
  // conference registration. Everyone at the gala is seated as an adult, so
  // youth/kids are always 0. The real ceiling on both categories is the
  // ballroom Venue's capacity, which they share — see GALA_EVENT_SLUG below.
  {
    id: "gala-seat",
    name: "Gala Dinner — Individual Seat",
    description: "Single seat at The Journey gala dinner. $300 FJD per person.",
    type: "individual",
    icon: "user",
    fee: 300,
    // Sanity ceiling per booking only — 10+ seats is a full table at the same
    // price, so the form steers those bookings to the table category instead.
    perRegCap: { adults: 9, youth: 0, kids: 0 },
    pool: null,
    seatsPerUnit: null,
    categoryCode: "GS",
  },
  {
    id: "gala-table",
    name: "Gala Dinner — Table of 10",
    description: "Reserved table of 10 seats at The Journey gala dinner. $3,000 FJD per table.",
    type: "individual",
    icon: "users",
    fee: 3000,
    // 10 tables — a sanity ceiling per booking, not the ballroom's limit.
    perRegCap: { adults: 100, youth: 0, kids: 0 },
    pool: null,
    seatsPerUnit: 10,
    categoryCode: "GT",
  },
];

// ── Gala dinner ──────────────────────────────────────────────────────────────
// The gala lives on its own Event row rather than a flag on the model, so the
// slug is what identifies it. Created/updated by `npx tsx prisma/seed-gala-event.ts`.
export const GALA_EVENT_SLUG = "the-journey-gala-dinner";
export const GALA_SEATS_PER_TABLE = 10;

export const GALA_CATEGORY_IDS = ["gala-seat", "gala-table"] as const;

export function isGalaCategory(categoryId: string): boolean {
  return (GALA_CATEGORY_IDS as readonly string[]).includes(categoryId);
}

// Printed on the ticket PDF and shown on the booking form. The date/venue also
// live on the Event/Venue rows (which is what the ticket reads); these are the
// gala-specific extras the generic Event model has no column for.
export const GALA_DETAILS = {
  eventName: "The Journey — AGFJ100 Gala Dinner",
  venueName: "Golden Ballroom, Sheraton Fiji Golf & Beach Resort",
  city: "Denarau",
  dateLabel: "Saturday, 12 December 2026",
  timeLabel: "4:00pm – 9:00pm",
  dressCode: "Semi-formal",
  enquiriesEmail: "agfjevents@gmail.com",
  enquiriesPhone: "+679 9359922",
} as const;

/**
 * The single place a registration's fee is derived from its category. Three
 * pricing shapes:
 *   - church tiers: flat per registration, regardless of headcount within cap
 *   - block-priced (gala table): flat per block of `seatsPerUnit` seats
 *   - everything else: per head
 *
 * `isChurchPath` is passed in rather than read off `catInfo.type` so this
 * matches the existing call sites exactly (creation keys off the submitted
 * `type`, amendment off the stored `Registration.type`).
 */
export function computeRegistrationFee(
  catInfo: CategoryInfo,
  opts: { isChurchPath: boolean; headcount: number }
): number {
  if (opts.isChurchPath) return catInfo.fee;
  if (catInfo.seatsPerUnit) {
    return catInfo.fee * Math.ceil(opts.headcount / catInfo.seatsPerUnit);
  }
  return catInfo.fee * opts.headcount;
}

export const YOUTH_AGE_RANGE = "15–25yrs";
// Collected as two separate sub-brackets in the registration forms (see
// KIDS_YOUNGER_AGE_RANGE / KIDS_OLDER_AGE_RANGE) but summed into a single
// `kids` count everywhere else — capacity caps, pools, and the Registration
// row itself don't distinguish between the two.
export const KIDS_AGE_RANGE = "5–10yrs; 11–14yrs";
export const KIDS_YOUNGER_AGE_RANGE = "5–10yrs";
export const KIDS_OLDER_AGE_RANGE = "11–14yrs";

// Absolute final date for all installment payments (per client spec).
export const INSTALLMENT_DEADLINE = new Date("2026-09-30T23:59:59+12:00");

export const INSTALLMENT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  { term: "Small Church", definition: "AG Fiji church with 25–50 members." },
  { term: "Medium Church", definition: "AG Fiji church with 51–100 members." },
  { term: "Large Church", definition: "AG Fiji church with 101–300 members." },
  { term: "Very Large Church", definition: "AG Fiji church with 300+ members." },
  { term: "Overseas", definition: "International guests attending from outside Fiji." },
  { term: "Individual", definition: "Personal registration for anyone who doesn't fit a local AG Fiji church category." },
  { term: "Adults", definition: "Attendees aged 26 and over." },
  { term: "NextGen / Youth", definition: `Attendees aged ${YOUTH_AGE_RANGE}.` },
  { term: "Kids", definition: `Attendees aged ${KIDS_AGE_RANGE}. Kids do not receive an entry QR code.` },
  { term: "Registrar", definition: "The person filling out this registration form — may be different from the Pastor/Leader." },
  { term: "Unique Registration ID", definition: "Your reference number for this registration. You must include it in your payment narration so HQ Finance can match your payment." },
  { term: "AG100 / AGFJ100", definition: "AG Fiji's 100th Anniversary celebration." },
];

export interface ChurchRegistration {
  category: RegistrationCategory;
  churchName: string;
  district: string;
  pastorName: string;
  pastorEmail: string;
  pastorPhone: string;
  numberOfAttendees: number;
  attendees: Attendee[];
  venue: string;
  paymentMethod: "bank-transfer";
  paymentStatus: "pending" | "completed" | "failed";
}

export interface IndividualRegistration {
  category: RegistrationCategory;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  church?: string;
  venue: string;
  paymentMethod: "bank-transfer";
  paymentStatus: "pending" | "completed" | "failed";
}

export interface Attendee {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}


export const DISTRICTS = [
  "Suva",
  "Nausori",
  "Lami",
  "Nasinu",
  "Nadi",
  "Lautoka",
  "Ba",
  "Tavua",
  "Rakiraki",
  "Sigatoka",
  "Labasa",
  "Savusavu",
  "Levuka",
  "Other",
];
