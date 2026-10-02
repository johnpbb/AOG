import * as XLSX from "xlsx";
import { createHash } from "crypto";

// Bank statement import: parse a Westpac (or any) CSV/Excel export, pull the
// AG100 registration reference out of each credit's narration, and classify
// how it lines up with what the registration still owes. Pure functions only —
// the API route does the DB reads/writes.

export interface StatementColumns {
  date: string | null;
  credit: string | null; // credit/deposit column, or a signed Amount column
  debit: string | null; // optional — only used to skip outflows
  signed: boolean; // true when `credit` is a single signed Amount column
}

export interface StatementLine {
  rowNumber: number; // 1-based row in the source file
  date: string;
  amount: number; // always a positive credit
  text: string; // every text cell joined — what we search for the RegID
  narration: string; // display-friendly narration
  fingerprint: string;
}

export interface ParsedStatement {
  headers: string[];
  columns: StatementColumns;
  lines: StatementLine[];
  skippedDebits: number;
}

const DATE_RE = /date/i;
const CREDIT_RE = /credit|deposit|money in|paid in|\bcr\b/i;
const DEBIT_RE = /debit|withdraw|money out|paid out|\bdr\b/i;
const AMOUNT_RE = /^\s*(transaction\s+)?amount/i;
const NARRATION_RE = /narrat|descr|particular|detail|reference|memo|remark|payee|other/i;

function isEmptyRow(row: unknown[]) {
  return row.every((c) => String(c ?? "").trim() === "");
}

// Bank exports often open with account-info lines before the real header, so
// look for the first row that reads like a header rather than assuming row 0.
function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = rows[i].map((c) => String(c ?? ""));
    const hasDate = cells.some((c) => DATE_RE.test(c));
    const hasMoney = cells.some((c) => CREDIT_RE.test(c) || DEBIT_RE.test(c) || AMOUNT_RE.test(c));
    if (hasDate && hasMoney) return i;
  }
  return 0;
}

export function detectColumns(headers: string[]): StatementColumns {
  const find = (re: RegExp) => headers.find((h) => h && re.test(h)) ?? null;
  const credit = find(CREDIT_RE);
  const debit = find(DEBIT_RE);
  const amount = find(AMOUNT_RE);
  return {
    date: find(DATE_RE),
    credit: credit ?? amount,
    debit: credit ? debit : null,
    signed: !credit && !!amount,
  };
}

// "1,234.50", "$300", "300.00 CR", "(300.00)", "-300" → number (negatives kept
// so signed Amount columns can be told apart from credits).
export function parseMoney(raw: unknown): number | null {
  let s = String(raw ?? "").trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) negative = true;
  if (/\bDR\b/i.test(s)) negative = true;
  s = s.replace(/[^0-9.\-]/g, "");
  if (s.startsWith("-")) negative = true;
  s = s.replace(/-/g, "");
  if (!s || isNaN(Number(s))) return null;
  const n = Number(s);
  return negative ? -n : n;
}

export function parseStatement(
  buffer: ArrayBuffer,
  overrides: Partial<Pick<StatementColumns, "date" | "credit" | "debit">> & { signed?: boolean } = {}
): ParsedStatement {
  const workbook = XLSX.read(buffer, { type: "array", raw: true, cellDates: false });
  const sheet = workbook.SheetNames[0] ? workbook.Sheets[workbook.SheetNames[0]] : null;
  if (!sheet) return { headers: [], columns: { date: null, credit: null, debit: null, signed: false }, lines: [], skippedDebits: 0 };

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const headerIdx = findHeaderRow(rows);
  const headers = (rows[headerIdx] ?? []).map((c) => String(c ?? "").trim());

  const detected = detectColumns(headers);
  const columns: StatementColumns = {
    date: overrides.date ?? detected.date,
    credit: overrides.credit ?? detected.credit,
    debit: overrides.debit ?? detected.debit,
    signed: overrides.signed ?? (overrides.credit ? !CREDIT_RE.test(overrides.credit) : detected.signed),
  };

  const idx = (name: string | null) => (name ? headers.indexOf(name) : -1);
  const dateI = idx(columns.date);
  const creditI = idx(columns.credit);
  const debitI = idx(columns.debit);

  const lines: StatementLine[] = [];
  const seen = new Map<string, number>();
  let skippedDebits = 0;
  if (creditI < 0) return { headers, columns, lines, skippedDebits };

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (isEmptyRow(row)) continue;

    const creditVal = parseMoney(row[creditI]);
    const debitVal = debitI >= 0 ? parseMoney(row[debitI]) : null;
    // A row counts as money-in only when the credit cell holds a positive number.
    if (creditVal === null || creditVal <= 0) {
      if ((debitVal ?? 0) > 0 || (creditVal ?? 0) < 0) skippedDebits++;
      continue;
    }

    const moneyCols = new Set([creditI, debitI, dateI]);
    const narrationCells: string[] = [];
    const textCells: string[] = [];
    row.forEach((cell, c) => {
      const v = String(cell ?? "").trim();
      if (!v || moneyCols.has(c)) return;
      // Skip pure-number cells (running balance etc.) but keep reference numbers
      // that sit in a narration-named column.
      const numeric = /^[\d,.\-$ ()]+$/.test(v) && parseMoney(v) !== null;
      if (numeric && !NARRATION_RE.test(headers[c] ?? "")) return;
      textCells.push(v);
      if (NARRATION_RE.test(headers[c] ?? "")) narrationCells.push(v);
    });

    const text = textCells.join(" | ");
    const date = dateI >= 0 ? String(row[dateI] ?? "").trim() : "";
    const narration = (narrationCells.length ? narrationCells : textCells).join(" | ");

    // Identical lines within one file (same day, amount, narration) get an
    // occurrence counter, so two genuine identical payments both import while
    // re-uploading the same file is still recognised as a duplicate.
    const base = `${date}|${creditVal.toFixed(2)}|${text.toUpperCase().replace(/\s+/g, " ")}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const fingerprint = createHash("sha1").update(`${base}#${n}`).digest("hex").slice(0, 16);

    lines.push({ rowNumber: r + 1, date, amount: creditVal, text, narration, fingerprint });
  }

  return { headers, columns, lines, skippedDebits };
}

// ── Matching ────────────────────────────────────────────────────────────

export interface MatchableRegistration {
  id: string;
  registrationId: string; // AG100-027VL301 (may carry a "-2" collision suffix)
  fee: number;
  paid: number; // sum of CONFIRMED payments
  paymentStatus: string;
  paymentType: string;
  label: string | null; // church / registrant name, for the review table
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Banks mangle hyphens and case ("AG100 027VL301", "ag100027vl301"), so the
// separator after AG100 (and before a collision suffix) is optional. The
// boundary guards stop AG100-027VL30 matching inside AG100-027VL301, and stop
// a base ID matching when the narration actually carries its "-2" sibling.
function buildRegex(registrationId: string): RegExp {
  const [prefix, core, ...suffix] = registrationId.toUpperCase().split("-").map(escapeRe);
  // Only the AG100↔code separator is fuzzy; a collision suffix must be a real hyphen.
  const body = `${prefix}[\\s\\-_]*${core}${suffix.map((p) => `-${p}`).join("")}`;
  return new RegExp(`(?<![A-Z0-9])${body}(?![A-Z0-9])(?!-\\d)`, "g");
}

export type MatchStatus =
  | "match" // exact balance — pre-selected
  | "partial" // less than the remaining balance
  | "over" // more than the remaining balance
  | "settled" // registration already fully paid
  | "duplicate" // this bank line was already imported
  | "ambiguous" // narration names more than one registration
  | "unmatched"; // no RegID found

export interface MatchedLine extends StatementLine {
  status: MatchStatus;
  registration: {
    id: string;
    registrationId: string;
    label: string | null;
    fee: number;
    remaining: number;
  } | null;
  candidates?: string[]; // for ambiguous rows
  note?: string;
}

export function matchLines(
  lines: StatementLine[],
  registrations: MatchableRegistration[],
  alreadyImported: Set<string>
): MatchedLine[] {
  const matchers = registrations.map((r) => ({ reg: r, re: buildRegex(r.registrationId) }));
  // Running totals so two lines in one file paying the same registration
  // (instalments) each see the balance left by the one before.
  const paidSoFar = new Map(registrations.map((r) => [r.id, r.paid]));

  return lines.map((line) => {
    if (alreadyImported.has(line.fingerprint)) {
      return { ...line, status: "duplicate", registration: null, note: "Already imported from a previous upload" };
    }

    const upper = line.text.toUpperCase();
    const hits = matchers
      .map((m) => {
        m.re.lastIndex = 0;
        const found = m.re.exec(upper);
        return found ? { reg: m.reg, start: found.index, end: found.index + found[0].length } : null;
      })
      .filter((h): h is NonNullable<typeof h> => h !== null)
      // Drop a hit that sits inside a longer hit (defence in depth alongside the regex guards).
      .filter((h, _i, all) => !all.some((o) => o !== h && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start));

    if (hits.length === 0) return { ...line, status: "unmatched", registration: null };
    if (hits.length > 1) {
      return { ...line, status: "ambiguous", registration: null, candidates: hits.map((h) => h.reg.registrationId), note: "Narration names more than one registration" };
    }

    const { reg } = hits[0];
    // Windcave-paid registrations are COMPLETED but have no Payment rows.
    const settled = reg.paymentStatus === "COMPLETED";
    const remaining = settled ? 0 : Math.max(0, reg.fee - (paidSoFar.get(reg.id) ?? 0));
    const registration = { id: reg.id, registrationId: reg.registrationId, label: reg.label, fee: reg.fee, remaining };

    if (remaining <= 0.005) return { ...line, status: "settled", registration, note: "This registration is already fully paid" };

    const diff = Math.round((line.amount - remaining) * 100) / 100;
    if (Math.abs(diff) < 0.005) {
      paidSoFar.set(reg.id, (paidSoFar.get(reg.id) ?? 0) + line.amount);
      return { ...line, status: "match", registration };
    }
    if (diff < 0) {
      paidSoFar.set(reg.id, (paidSoFar.get(reg.id) ?? 0) + line.amount);
      return { ...line, status: "partial", registration, note: `Short by $${(-diff).toFixed(2)} — recorded as an instalment` };
    }
    return { ...line, status: "over", registration, note: `Over by $${diff.toFixed(2)}` };
  });
}

// Marker stored in Payment.referenceNote so a re-upload can be recognised
// without a schema change.
export const bankMarker = (fingerprint: string) => `[BANK:${fingerprint}]`;
export const BANK_MARKER_RE = /\[BANK:([0-9a-f]{16})\]/g;
