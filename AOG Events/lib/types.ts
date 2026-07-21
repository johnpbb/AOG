export type RegistrationCategory =
  | "very-large-church"
  | "large-church"
  | "medium-church"
  | "small-church"
  | "church-plant"
  | "world-fijian-congress"
  | "wfc-partners"
  | "individual";

export interface CategoryInfo {
  id: RegistrationCategory;
  name: string;
  description: string;
  type: "church" | "individual";
  icon: string;
  fee: number;
  registrationLimit: number | null; // null = no registration count cap
  ticketPool: number;               // total seats shared across all registrations
  maxTicketsPerReg: number;         // max tickets one registration can request
  /**
   * Code used in the reference number formula: AG100-{churchId}{categoryCode}{total}.
   * Spec only defined SM/MD/VL/OS/IN/MI — LG and CP are our provisional extensions
   * for categories the client's spec didn't anticipate. Pending client sign-off.
   */
  categoryCode: string;
}

export const REGISTRATION_CATEGORIES: CategoryInfo[] = [
  {
    id: "very-large-church",
    name: "Very Large Church",
    description: "Churches with 500+ members",
    type: "church",
    icon: "building",
    fee: 10000,
    registrationLimit: 5,
    ticketPool: 2500,
    maxTicketsPerReg: 2500,
    categoryCode: "VL",
  },
  {
    id: "large-church",
    name: "Large Church",
    description: "Churches with 200-499 members",
    type: "church",
    icon: "building",
    fee: 5000,
    registrationLimit: 50,
    ticketPool: 3500,
    maxTicketsPerReg: 3500,
    categoryCode: "LG",
  },
  {
    id: "medium-church",
    name: "Medium Church",
    description: "Churches with 100-199 members",
    type: "church",
    icon: "building",
    fee: 3000,
    registrationLimit: 132,
    ticketPool: 6000,
    maxTicketsPerReg: 6000,
    categoryCode: "MD",
  },
  {
    id: "small-church",
    name: "Small Church",
    description: "Churches with 50-99 members",
    type: "church",
    icon: "building",
    fee: 1000,
    registrationLimit: 175,
    ticketPool: 4000,
    maxTicketsPerReg: 4000,
    categoryCode: "SM",
  },
  {
    id: "church-plant",
    name: "Church Plant",
    description: "New church plants under 50 members",
    type: "church",
    icon: "sprout",
    fee: 500,
    registrationLimit: 38,
    ticketPool: 1000,
    maxTicketsPerReg: 1000,
    categoryCode: "CP",
  },
  {
    id: "world-fijian-congress",
    name: "World Fijian Congress",
    description: "Overseas Network representatives",
    type: "church",
    icon: "globe",
    fee: 0,
    registrationLimit: 5,
    ticketPool: 1500,
    maxTicketsPerReg: 1500,
    categoryCode: "OS",
  },
  {
    id: "wfc-partners",
    name: "WFC Partners",
    description: "Missionaries & Partners",
    type: "individual",
    icon: "users",
    fee: 0,
    registrationLimit: null,
    ticketPool: 500,
    maxTicketsPerReg: 500,
    categoryCode: "MI",
  },
  {
    id: "individual",
    name: "Individual Attendee",
    description: "Personal registration — register yourself and up to 9 friends or family",
    type: "individual",
    icon: "user",
    fee: 100,
    registrationLimit: null,
    ticketPool: 1000,
    maxTicketsPerReg: 10,
    categoryCode: "IN",
  },
];

// Pending final client confirmation — current working assumption is 13–25.
export const YOUTH_AGE_RANGE = "13–25";
export const KIDS_AGE_RANGE = "6–12";

// Absolute final date for all installment payments (per client spec).
export const INSTALLMENT_DEADLINE = new Date("2026-09-30T23:59:59+12:00");

export const INSTALLMENT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  { term: "Small Church", definition: "AG Fiji church with 50–99 members." },
  { term: "Medium Church", definition: "AG Fiji church with 100–199 members." },
  { term: "Large Church", definition: "AG Fiji church with 200–499 members." },
  { term: "Very Large Church", definition: "AG Fiji church with 500+ members." },
  { term: "Church Plant", definition: "A new church under 50 members." },
  { term: "World Fijian Congress (WFC)", definition: "Overseas Fijian church network representatives — Australia, New Zealand, USA, and Great Britain." },
  { term: "AGFJ Missionaries", definition: "Missionaries and partners affiliated with AG Fiji serving overseas." },
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
  paymentMethod: "online" | "bank-transfer";
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
  paymentMethod: "online" | "bank-transfer";
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
