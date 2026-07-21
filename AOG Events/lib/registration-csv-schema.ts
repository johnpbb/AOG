import { REGISTRATION_CATEGORIES } from "@/lib/types";
import type { CreateRegistrationInput } from "@/lib/create-registration";

// The upload template is a deliberate subset of the full registrations
// export (app/api/admin/reports/route.ts) — only fields an importer should
// actually set. Read-only/system columns there (ticket numbers, registered
// at, etc.) are intentionally left out here so the two don't drift into
// implying the importer can set things it can't.
export const CSV_HEADERS = [
  "Church ID",
  "Type",
  "Category",
  "Registrar Name",
  "Pastor Name",
  "First Name",
  "Last Name",
  "Contact Email",
  "Contact Phone",
  "Adults",
  "Youth",
  "Kids",
  "Number of Tickets",
  "Payment Method",
  "Payment Type",
  "Installments",
] as const;

export const CSV_TEMPLATE_EXAMPLE_ROWS: string[][] = [
  ["027", "church", "large-church", "Jane Doe", "Pr. John Smith", "", "", "jane@example.com", "9991234", "80", "20", "10", "", "bank-transfer", "full", ""],
  ["", "individual", "individual", "", "", "Mele", "Tuilagi", "mele@example.com", "9995678", "", "", "", "2", "bank-transfer", "partial", "3"],
];

export interface ParsedCsvRow {
  rowNumber: number; // 1-indexed, matches the row's position in the uploaded file (excluding header)
  raw: Record<string, string>;
  errors: string[];
  input: CreateRegistrationInput | null; // null if errors is non-empty
}

const VALID_CATEGORY_IDS = new Set(REGISTRATION_CATEGORIES.map((c) => c.id));

/** Validates one already-parsed CSV row (as a header->value record) against the same rules the public form enforces. */
export function validateCsvRow(
  raw: Record<string, string>,
  rowNumber: number,
  eventId: string,
  knownChurchIds: Set<string>
): ParsedCsvRow {
  const errors: string[] = [];
  const get = (header: string) => (raw[header] ?? "").trim();

  const type = get("Type").toLowerCase();
  if (type !== "church" && type !== "individual") {
    errors.push(`Type must be "church" or "individual" (got "${get("Type")}")`);
  }

  const category = get("Category");
  if (!VALID_CATEGORY_IDS.has(category as any)) {
    errors.push(`Unknown category "${category}"`);
  }

  const contactEmail = get("Contact Email");
  if (!contactEmail || !contactEmail.includes("@")) {
    errors.push("Contact Email is required and must be a valid email");
  }

  const churchId = get("Church ID");
  if (type === "church" && churchId && !knownChurchIds.has(churchId)) {
    errors.push(`Church ID "${churchId}" not found`);
  }

  const paymentMethod = get("Payment Method").toLowerCase() || "bank-transfer";
  if (!["bank-transfer", "online"].includes(paymentMethod)) {
    errors.push(`Payment Method must be "bank-transfer" or "online" (got "${get("Payment Method")}")`);
  }

  const paymentType = get("Payment Type").toLowerCase() || "full";
  if (!["full", "partial"].includes(paymentType)) {
    errors.push(`Payment Type must be "full" or "partial" (got "${get("Payment Type")}")`);
  }

  let installmentCount: number | undefined;
  if (paymentType === "partial") {
    const raw = parseInt(get("Installments"), 10);
    if (Number.isNaN(raw) || raw < 2 || raw > 10) {
      errors.push("Installments must be a number from 2 to 10 when Payment Type is partial");
    } else {
      installmentCount = raw;
    }
  }

  let adults = 0, youth = 0, kids = 0, numberOfTickets = 1;
  if (type === "church") {
    adults = Math.max(0, parseInt(get("Adults"), 10) || 0);
    youth = Math.max(0, parseInt(get("Youth"), 10) || 0);
    kids = Math.max(0, parseInt(get("Kids"), 10) || 0);
    if (adults + youth + kids <= 0) {
      errors.push("At least one of Adults/Youth/Kids must be greater than zero for a church registration");
    }
    if (!get("Registrar Name")) errors.push("Registrar Name is required for a church registration");
  } else if (type === "individual") {
    numberOfTickets = Math.max(1, parseInt(get("Number of Tickets"), 10) || 1);
    if (!get("First Name") || !get("Last Name")) {
      errors.push("First Name and Last Name are required for an individual registration");
    }
  }

  const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === category);
  if (catInfo && type === "church" && adults + youth + kids > catInfo.maxTicketsPerReg) {
    errors.push(`Total attendees exceed the ${catInfo.maxTicketsPerReg.toLocaleString()} limit for ${catInfo.name}`);
  }
  if (catInfo && type === "individual" && numberOfTickets > catInfo.maxTicketsPerReg) {
    errors.push(`Number of tickets exceeds the ${catInfo.maxTicketsPerReg.toLocaleString()} limit for ${catInfo.name}`);
  }

  if (errors.length > 0) {
    return { rowNumber, raw, errors, input: null };
  }

  const fee = catInfo ? (type === "individual" ? catInfo.fee * numberOfTickets : catInfo.fee) : 0;

  const input: CreateRegistrationInput = {
    category,
    type,
    email: contactEmail,
    phone: get("Contact Phone") || null,
    churchId: type === "church" ? churchId || null : null,
    registrarName: type === "church" ? get("Registrar Name") : null,
    contactEmail,
    contactPhone: get("Contact Phone") || null,
    contactPreference: "personal",
    eventId,
    paymentMethod,
    fee,
    numberOfTickets,
    adults,
    youth,
    kids,
    paymentType,
    installmentCount,
    formData:
      type === "church" ? { pastorName: get("Pastor Name") || null } : { firstName: get("First Name"), lastName: get("Last Name") },
  };

  return { rowNumber, raw, errors: [], input };
}
