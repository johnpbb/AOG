export type RegistrationCategory =
  | "very-large-church"
  | "large-church"
  | "medium-church"
  | "small-church"
  | "individual"
  | "overseas-delegates";

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
  // Individual/Overseas Delegates instead of a per-registration cap.
  pool: AgeCaps | null;
  /**
   * Code used in the reference number formula: AG100-{churchId}{categoryCode}{total}.
   * Spec only defined SM/MD/VL/OS/IN/MI — LG and OD are our provisional extensions
   * for categories the client's spec didn't anticipate. Pending client sign-off.
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
    categoryCode: "IN",
  },
  {
    id: "overseas-delegates",
    name: "Overseas Delegates",
    description: "International guests and delegates",
    type: "individual",
    icon: "globe",
    fee: 100, // Matches Individual Attendee rate for now, per client request — Master doc has no fee column.
    perRegCap: null,
    pool: { adults: 1000, youth: 500, kids: 100 },
    categoryCode: "OD",
  },
];

export const YOUTH_AGE_RANGE = "15–25yrs";
export const KIDS_AGE_RANGE = "5–10yrs; 11–14yrs";

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
  { term: "Overseas Delegates", definition: "International guests and delegates attending from outside Fiji." },
  { term: "Individual", definition: "Personal registration for international guests or anyone who doesn't fit a local AG Fiji church category." },
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
  paymentMethod: "bank-transfer" | "mpaisa" | "world-remit";
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
  paymentMethod: "bank-transfer" | "mpaisa" | "world-remit";
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
