// One-row-per-PERSON CSV, distinct from lib/registration-csv-schema.ts (which
// is one-row-per-REGISTRATION, admin-only bulk import). This is the format a
// church registrant uploads at public registration time to name every
// attending adult/youth — kids stay headcount-only and never appear here.
export const ATTENDEE_CSV_HEADERS = ["First Name", "Last Name", "Age Category", "Email", "Phone"] as const;

export const ATTENDEE_CSV_TEMPLATE_EXAMPLE_ROWS: string[][] = [
  ["John", "Doe", "Adult", "john@example.com", ""],
  ["Jane", "Doe", "Youth", "", "9991234"],
];

export interface ParsedAttendeeCsvRow {
  rowNumber: number; // 1-indexed, matches the row's position in the uploaded file (excluding header)
  raw: Record<string, string>;
  errors: string[];
  attendee: { firstName: string; lastName: string; ageCategory: "ADULT" | "YOUTH"; email?: string; phone?: string } | null;
}

/** Validates one already-parsed CSV row (as a header->value record). */
export function validateAttendeeCsvRow(raw: Record<string, string>, rowNumber: number): ParsedAttendeeCsvRow {
  const errors: string[] = [];
  const get = (header: string) => (raw[header] ?? "").trim();

  const firstName = get("First Name");
  const lastName = get("Last Name");
  if (!firstName) errors.push("First Name is required");
  if (!lastName) errors.push("Last Name is required");

  const rawAgeCategory = get("Age Category").toLowerCase();
  let ageCategory: "ADULT" | "YOUTH" | null = null;
  if (rawAgeCategory === "adult") ageCategory = "ADULT";
  else if (rawAgeCategory === "youth") ageCategory = "YOUTH";
  else errors.push(`Age Category must be "Adult" or "Youth" (got "${get("Age Category")}")`);

  const email = get("Email");
  if (email && !email.includes("@")) errors.push("Email must be a valid email address");

  if (errors.length > 0 || !ageCategory) {
    return { rowNumber, raw, errors: errors.length > 0 ? errors : ["Invalid row"], attendee: null };
  }

  return {
    rowNumber,
    raw,
    errors: [],
    attendee: {
      firstName,
      lastName,
      ageCategory,
      email: email || undefined,
      phone: get("Phone") || undefined,
    },
  };
}

/** Parses an already-Papa.parse'd array of header->value rows into validated attendee rows. */
export function validateAttendeeCsvRows(rows: Record<string, string>[]): ParsedAttendeeCsvRow[] {
  return rows.map((raw, i) => validateAttendeeCsvRow(raw, i + 1));
}
