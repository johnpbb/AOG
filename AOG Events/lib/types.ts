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
}

export const REGISTRATION_CATEGORIES: CategoryInfo[] = [
  {
    id: "very-large-church",
    name: "Very Large Church",
    description: "Churches with 500+ members",
    type: "church",
    icon: "building",
    fee: 10000,
  },
  {
    id: "large-church",
    name: "Large Church",
    description: "Churches with 200-499 members",
    type: "church",
    icon: "building",
    fee: 5000,
  },
  {
    id: "medium-church",
    name: "Medium Church",
    description: "Churches with 100-199 members",
    type: "church",
    icon: "building",
    fee: 3000,
  },
  {
    id: "small-church",
    name: "Small Church",
    description: "Churches with 50-99 members",
    type: "church",
    icon: "building",
    fee: 1000,
  },
  {
    id: "church-plant",
    name: "Church Plant",
    description: "New church plants under 50 members",
    type: "church",
    icon: "sprout",
    fee: 500,
  },
  {
    id: "world-fijian-congress",
    name: "World Fijian Congress",
    description: "Overseas Network representatives",
    type: "church",
    icon: "globe",
    fee: 0, // Pledge based
  },
  {
    id: "wfc-partners",
    name: "WFC Partners",
    description: "Missionaries & Partners",
    type: "individual",
    icon: "users",
    fee: 0, // Sponsored
  },
  {
    id: "individual",
    name: "Individual Attendee",
    description: "Personal registration",
    type: "individual",
    icon: "user",
    fee: 100,
  },
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

export interface Venue {
  id: string;
  name: string;
  capacity: number;
  currentRegistrations: number;
}

export const VENUES: Venue[] = [
  {
    id: "main-arena",
    name: "Main Arena",
    capacity: 10000,
    currentRegistrations: 0,
  },
  {
    id: "conference-hall",
    name: "Conference Hall",
    capacity: 5000,
    currentRegistrations: 0,
  },
  {
    id: "overflow-venue",
    name: "Overflow Venue",
    capacity: 6000,
    currentRegistrations: 0,
  },
];

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
