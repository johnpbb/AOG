import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { ledgerCategoryLabel, ledgerDisplayName } from "@/lib/ledger-labels";
import { startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { GALA_EVENT_SLUG } from "@/lib/types";

type Format = "csv" | "xlsx";
type ReportType =
  | "registrations"
  | "payments"
  | "venues"
  | "categories"
  | "checkin"
  | "churches"
  | "ledger"
  | "attendees"
  | "full-status"
  | "gala";

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractName(type: string, formData: unknown, email: string): string {
  const d = (formData ?? {}) as Record<string, string>;
  if (type === "CHURCH") {
    return (
      d.churchName ||
      d.pastorName ||
      `${d.pastorFirstName ?? ""} ${d.pastorLastName ?? ""}`.trim() ||
      email
    );
  }
  return `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || email;
}

function attendeeNames(attendees: { firstName: string; lastName: string }[]): string {
  return attendees.map((a) => `${a.firstName} ${a.lastName}`.trim()).join("; ");
}

function extractPhone(formData: unknown): string {
  const d = (formData ?? {}) as Record<string, string>;
  return d.phone || d.pastorPhone || d.contactPhone || "";
}

function extractChurchName(formData: unknown): string {
  const d = (formData ?? {}) as Record<string, string>;
  return d.churchName || "";
}

function extractDenomination(formData: unknown): string {
  const d = (formData ?? {}) as Record<string, string>;
  return d.denomination || d.churchDenomination || "";
}

function extractCity(formData: unknown): string {
  const d = (formData ?? {}) as Record<string, string>;
  return d.city || d.churchCity || d.location || "";
}

function dateRangeFilter(dateRange: string): Date | null {
  const now = new Date();
  switch (dateRange) {
    case "today": return startOfDay(now);
    case "week":  return startOfWeek(now, { weekStartsOn: 1 });
    case "month": return startOfMonth(now);
    default:      return null;
  }
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

function toXLSX(rows: unknown[][], sheetName: string): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Bold the header row
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true } };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function fileResponse(data: Buffer | string, filename: string, format: Format) {
  const contentType =
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv";
  return new NextResponse(data, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ── Report builders ───────────────────────────────────────────────────────────

async function registrationsReport(
  format: Format,
  dateFrom: Date | null,
  categoryFilter: string
) {
  const where: Record<string, unknown> = {};
  if (dateFrom) where.createdAt = { gte: dateFrom };
  if (categoryFilter === "churches") where.type = "CHURCH";
  if (categoryFilter === "individuals") where.type = "INDIVIDUAL";

  const regs = await prisma.registration.findMany({
    where,
    include: {
      event: { select: { name: true } },
      venue: { select: { name: true, city: true } },
      venueAllocations: { include: { venue: { select: { name: true } } } },
      tickets: { select: { ticketNumber: true } },
      attendees: { select: { firstName: true, lastName: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Registration ID", "Church ID", "Type", "Category", "Name", "Email", "Phone",
    "Adults", "Youth", "Kids", "Attendee Names", "Event", "Venue", "Tickets", "Ticket Numbers",
    "Payment Method", "Payment Status", "Payment Type", "Installments", "Fee (FJD)", "Registered At",
  ];

  const rows = regs.map((r) => [
    r.registrationId,
    r.churchId ?? "",
    r.type,
    r.category,
    extractName(r.type, r.formData, r.email),
    r.email,
    extractPhone(r.formData),
    r.adults,
    r.youth,
    r.kids,
    attendeeNames(r.attendees),
    r.event?.name ?? "",
    r.venueAllocations.length > 0
      ? r.venueAllocations.map((a) => `${a.venue.name} (${a.count} ${a.audienceType})`).join("; ")
      : r.venue?.name ?? "",
    r.tickets.length,
    r.tickets.map((t) => t.ticketNumber).join(", "),
    r.paymentMethod,
    r.paymentStatus,
    r.paymentType,
    r.installmentCount ?? "",
    r.fee.toFixed(2),
    new Date(r.createdAt).toLocaleString("en-FJ", { timeZone: "Pacific/Fiji" }),
  ]);

  const all = [headers, ...rows];
  const filename = `registrations-${Date.now()}.${format}`;
  return format === "xlsx"
    ? fileResponse(toXLSX(all, "Registrations"), filename, format)
    : fileResponse(Buffer.from(toCSV(all)), filename, format);
}

async function paymentsReport(
  format: Format,
  dateFrom: Date | null,
  categoryFilter: string
) {
  const where: Record<string, unknown> = {};
  if (dateFrom) where.createdAt = { gte: dateFrom };
  if (categoryFilter === "churches") where.type = "CHURCH";
  if (categoryFilter === "individuals") where.type = "INDIVIDUAL";

  const regs = await prisma.registration.findMany({
    where,
    include: { payments: { include: { confirmedBy: { select: { name: true } } }, orderBy: { confirmedAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Registration ID", "Name", "Email", "Category",
    "Payment Method", "Payment Status", "Fee (FJD)", "Amount Paid (FJD)", "Remaining Balance (FJD)",
    "Last Confirmed By", "Payment Reference", "Registered At",
  ];

  const rows = regs.map((r) => {
    const amountPaid = r.payments.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + p.amount, 0);
    return [
      r.registrationId,
      extractName(r.type, r.formData, r.email),
      r.email,
      r.category,
      r.paymentMethod,
      r.paymentStatus,
      r.fee.toFixed(2),
      amountPaid.toFixed(2),
      Math.max(0, r.fee - amountPaid).toFixed(2),
      r.payments[0]?.confirmedBy?.name ?? "",
      r.paymentRef ?? "",
      new Date(r.createdAt).toLocaleString("en-FJ", { timeZone: "Pacific/Fiji" }),
    ];
  });

  // Summary totals row
  const totalFee = regs.reduce((s, r) => s + r.fee, 0);
  const totalPaid = regs.reduce((s, r) => s + r.payments.filter((p) => p.status === "CONFIRMED").reduce((a, p) => a + p.amount, 0), 0);
  const completed = regs.filter((r) => r.paymentStatus === "COMPLETED").length;
  const pending = regs.filter((r) => r.paymentStatus === "PENDING").length;
  rows.push([]);
  rows.push([
    "TOTAL", "", "", "", "",
    `${completed} Completed / ${pending} Pending`,
    totalFee.toFixed(2), totalPaid.toFixed(2), Math.max(0, totalFee - totalPaid).toFixed(2),
    "", "", "",
  ]);

  const all = [headers, ...rows];
  const filename = `payments-${Date.now()}.${format}`;
  return format === "xlsx"
    ? fileResponse(toXLSX(all, "Payments"), filename, format)
    : fileResponse(Buffer.from(toCSV(all)), filename, format);
}

async function venuesReport(format: Format) {
  const venues = await prisma.venue.findMany({
    include: { event: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const headers = [
    "Venue", "City", "Event", "Capacity", "Registered", "Remaining", "% Utilized",
  ];

  const rows = venues.map((v) => {
    const pct = v.capacity > 0
      ? ((v.currentRegistrations / v.capacity) * 100).toFixed(1)
      : "0.0";
    return [
      v.name,
      v.city ?? "",
      v.event?.name ?? "",
      v.capacity,
      v.currentRegistrations,
      v.capacity - v.currentRegistrations,
      `${pct}%`,
    ];
  });

  const all = [headers, ...rows];
  const filename = `venues-${Date.now()}.${format}`;
  return format === "xlsx"
    ? fileResponse(toXLSX(all, "Venues"), filename, format)
    : fileResponse(Buffer.from(toCSV(all)), filename, format);
}

async function categoriesReport(
  format: Format,
  dateFrom: Date | null
) {
  const where: Record<string, unknown> = {};
  if (dateFrom) where.createdAt = { gte: dateFrom };

  const regs = await prisma.registration.findMany({ where });

  const map = new Map<string, { count: number; attendees: number; revenue: number }>();
  for (const r of regs) {
    const existing = map.get(r.category) ?? { count: 0, attendees: 0, revenue: 0 };
    map.set(r.category, {
      count: existing.count + 1,
      attendees: existing.attendees + r.numberOfAttendees,
      revenue: existing.revenue + r.fee,
    });
  }

  const total = regs.length;
  const headers = ["Category", "Registrations", "% of Total", "Attendees", "Revenue (FJD)"];
  const rows = [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([cat, v]) => [
      cat,
      v.count,
      total > 0 ? `${((v.count / total) * 100).toFixed(1)}%` : "0%",
      v.attendees,
      v.revenue.toFixed(2),
    ]);

  const totalRevenue = regs.reduce((s, r) => s + r.fee, 0);
  const totalAttendees = regs.reduce((s, r) => s + r.numberOfAttendees, 0);
  rows.push([]);
  rows.push(["TOTAL", total, "100%", totalAttendees, totalRevenue.toFixed(2)]);

  const all = [headers, ...rows];
  const filename = `categories-${Date.now()}.${format}`;
  return format === "xlsx"
    ? fileResponse(toXLSX(all, "Categories"), filename, format)
    : fileResponse(Buffer.from(toCSV(all)), filename, format);
}

async function checkinReport(format: Format, dateFrom: Date | null) {
  const where: Record<string, unknown> = {};
  if (dateFrom) where.checkedInAt = { gte: dateFrom };

  const checkIns = await prisma.dailyCheckIn.findMany({
    where,
    include: {
      ticket: { select: { ticketNumber: true, ticketType: true } },
      registration: {
        select: {
          registrationId: true,
          type: true,
          category: true,
          formData: true,
          email: true,
          venue: { select: { name: true, city: true } },
        },
      },
    },
    orderBy: { checkInDate: "desc" },
  });

  // Group by ticket (falling back to registration for legacy pre-cutover rows
  // that have no ticketId)
  const map = new Map<
    string,
    { ticket: typeof checkIns[0]["ticket"]; reg: typeof checkIns[0]["registration"]; dates: string[] }
  >();

  for (const c of checkIns) {
    const key = c.ticketId ?? `reg:${c.registrationId}`;
    const existing = map.get(key);
    if (existing) {
      existing.dates.push(c.checkInDate);
    } else {
      map.set(key, { ticket: c.ticket, reg: c.registration, dates: [c.checkInDate] });
    }
  }

  const headers = [
    "Ticket Number", "Ticket Type", "Registration ID", "Name", "Category", "Venue", "Venue City",
    "Days Checked In", "Check-In Dates",
  ];

  const rows = [...map.values()].map(({ ticket, reg, dates }) => {
    const sorted = [...new Set(dates)].sort();
    return [
      ticket?.ticketNumber ?? "",
      ticket?.ticketType ?? "",
      reg.registrationId,
      extractName(reg.type, reg.formData, reg.email),
      reg.category,
      reg.venue?.name ?? "",
      reg.venue?.city ?? "",
      sorted.length,
      sorted.join(", "),
    ];
  });

  const all = [headers, ...rows];
  const filename = `checkins-${Date.now()}.${format}`;
  return format === "xlsx"
    ? fileResponse(toXLSX(all, "Check-Ins"), filename, format)
    : fileResponse(Buffer.from(toCSV(all)), filename, format);
}

async function churchesReport(format: Format, dateFrom: Date | null) {
  const where: Record<string, unknown> = { type: "CHURCH" };
  if (dateFrom) where.createdAt = { gte: dateFrom };

  const regs = await prisma.registration.findMany({
    where,
    include: {
      venue: { select: { name: true, city: true } },
      attendees: { select: { firstName: true, lastName: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Church ID", "Church Name", "Denomination", "City", "Pastor Name", "Email", "Phone",
    "Category", "Adults", "Youth", "Kids", "Attendees", "Member Names", "Venue", "Registration ID", "Payment Status",
  ];

  const rows = regs.map((r) => {
    const d = (r.formData ?? {}) as Record<string, string>;
    const pastorName = `${d.pastorFirstName ?? ""} ${d.pastorLastName ?? ""}`.trim() || d.pastorName || "";
    return [
      r.churchId ?? "",
      extractChurchName(r.formData),
      extractDenomination(r.formData),
      extractCity(r.formData) || r.venue?.city || "",
      pastorName,
      r.email,
      extractPhone(r.formData),
      r.category,
      r.adults,
      r.youth,
      r.kids,
      r.numberOfAttendees,
      attendeeNames(r.attendees),
      r.venue?.name ?? "",
      r.registrationId,
      r.paymentStatus,
    ];
  });

  const all = [headers, ...rows];
  const filename = `churches-${Date.now()}.${format}`;
  return format === "xlsx"
    ? fileResponse(toXLSX(all, "Church Directory"), filename, format)
    : fileResponse(Buffer.from(toCSV(all)), filename, format);
}

async function attendeesReport(
  format: Format,
  dateFrom: Date | null,
  categoryFilter: string
) {
  const regWhere: Record<string, unknown> = {};
  if (dateFrom) regWhere.createdAt = { gte: dateFrom };
  if (categoryFilter === "churches") regWhere.type = "CHURCH";
  if (categoryFilter === "individuals") regWhere.type = "INDIVIDUAL";

  const attendees = await prisma.attendee.findMany({
    where: { registration: regWhere },
    include: {
      ticket: { select: { ticketNumber: true } },
      registration: {
        select: {
          registrationId: true, type: true, category: true, formData: true,
          email: true, paymentStatus: true, createdAt: true,
        },
      },
    },
    orderBy: [{ registration: { createdAt: "desc" } }, { createdAt: "asc" }],
  });

  const headers = [
    "Registration ID", "Church / Registrant", "Category", "First Name", "Last Name",
    "Age Category", "Email", "Phone", "Ticket Number", "Payment Status",
  ];

  const rows = attendees.map((a) => [
    a.registration.registrationId,
    extractName(a.registration.type, a.registration.formData, a.registration.email),
    a.registration.category,
    a.firstName,
    a.lastName,
    a.ageCategory,
    a.email ?? "",
    a.phone ?? "",
    a.ticket?.ticketNumber ?? "",
    a.registration.paymentStatus,
  ]);

  const all = [headers, ...rows];
  const filename = `attendees-${Date.now()}.${format}`;
  return format === "xlsx"
    ? fileResponse(toXLSX(all, "Attendees"), filename, format)
    : fileResponse(Buffer.from(toCSV(all)), filename, format);
}

async function ledgerReport(format: Format) {
  const regs = await prisma.registration.findMany({
    where: { paymentStatus: { not: "CANCELLED" } },
    include: {
      church: { select: { name: true } },
      payments: { select: { amount: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Registration ID", "Name", "Church", "Category", "Payment Type", "Installments",
    "Installment Deadline", "Total Fee (FJD)", "Amount Paid (FJD)", "Remaining Balance (FJD)", "Status",
  ];

  const rows = regs.map((r) => {
    const amountPaid = r.payments.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + p.amount, 0);
    return [
      r.registrationId,
      ledgerDisplayName(r.church?.name, r.formData, r.email),
      r.church?.name ?? "",
      ledgerCategoryLabel(r.category),
      r.paymentType,
      r.installmentCount ?? "",
      r.installmentDeadline ? new Date(r.installmentDeadline).toLocaleDateString("en-FJ") : "",
      r.fee.toFixed(2),
      amountPaid.toFixed(2),
      Math.max(0, r.fee - amountPaid).toFixed(2),
      r.paymentStatus,
    ];
  });

  const all = [headers, ...rows];
  const filename = `ledger-${Date.now()}.${format}`;
  return format === "xlsx"
    ? fileResponse(toXLSX(all, "Finance Ledger"), filename, format)
    : fileResponse(Buffer.from(toCSV(all)), filename, format);
}

// ── Full status reports (every church, registered or not) ───────────────────

type RegForStatus = {
  registrationId: string;
  type: string;
  category: string;
  churchId: string | null;
  email: string;
  phone: string | null;
  formData: unknown;
  numberOfAttendees: number;
  fee: number;
  paymentStatus: string;
  paymentType: string;
  createdAt: Date;
  payments: { amount: number; status: string }[];
  attendees: unknown[];
};

const confirmedPaid = (r: RegForStatus) =>
  r.payments.filter((x) => x.status === "CONFIRMED").reduce((a, x) => a + x.amount, 0);

function paymentLabel(fee: number, paid: number) {
  if (paid <= 0) return "Not paid";
  return paid >= fee - 0.005 ? "Paid in full" : "Part paid";
}

// "Complete" = as many names submitted as the registration expects.
function namesLabel(r: RegForStatus) {
  if (r.attendees.length === 0) return "None submitted";
  return r.attendees.length >= r.numberOfAttendees ? "Complete" : "Partial";
}

function personName(r: RegForStatus) {
  const d = (r.formData ?? {}) as Record<string, string>;
  if (r.type === "CHURCH") {
    return d.pastorName || `${d.pastorFirstName ?? ""} ${d.pastorLastName ?? ""}`.trim();
  }
  return `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim();
}

const isCancelled = (r: RegForStatus) =>
  r.paymentStatus === "CANCELLED" || r.paymentStatus === "FAILED";

// Live snapshot, never date-filtered: an admin can run it at any time.
async function fullStatusReport(format: Format) {
  const [churches, regs] = await Promise.all([
    prisma.church.findMany({
      where: { isActive: true },
      orderBy: [{ country: "asc" }, { district: "asc" }, { name: "asc" }],
    }),
    prisma.registration.findMany({
      where: { event: { slug: { not: GALA_EVENT_SLUG } } },
      include: { payments: true, attendees: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const headers = [
    "Type", "Division", "Code", "Name", "Country", "Category", "Registration Status",
    "Registration ID", "Attendees Expected", "Names Submitted", "Names Status",
    "Fee (FJD)", "Paid (FJD)", "Balance (FJD)", "Payment Status", "Payment Type",
    "Contact Name", "Email", "Phone", "Registered On",
  ];
  const blank = (n: number) => Array<string>(n).fill("");
  const line = (
    type: string, division: string, code: string, name: string, country: string,
    category: string, status: string, r: RegForStatus | null
  ) => {
    if (!r) return [type, division, code, name, country, category, status, ...blank(13)];
    const paid = confirmedPaid(r);
    return [
      type, division, code, name, country, category, status, r.registrationId,
      r.numberOfAttendees, r.attendees.length, namesLabel(r),
      r.fee.toFixed(2), paid.toFixed(2), (r.fee - paid).toFixed(2), paymentLabel(r.fee, paid),
      r.paymentType === "partial" ? "Installments" : "Full",
      personName(r), r.email, r.phone ?? "", r.createdAt.toISOString().slice(0, 10),
    ];
  };

  const rows: unknown[][] = [];
  const churchIds = new Set(churches.map((c) => c.id));
  for (const c of churches) {
    const mine = regs.filter((r) => r.churchId === c.id);
    const live = mine.filter((r) => !isCancelled(r));
    if (live.length === 0) {
      rows.push(line("Church", c.district ?? "", c.id, c.name, c.country, c.category ?? "",
        mine.length ? "Not registered (cancelled)" : "Not registered", null));
      continue;
    }
    for (const r of live) {
      rows.push(line("Church", c.district ?? "", c.id, c.name, c.country, c.category ?? "", "Registered", r));
    }
  }
  // Church registrations whose church is no longer on the active list.
  for (const r of regs.filter((r) => r.type === "CHURCH" && !isCancelled(r) && !(r.churchId && churchIds.has(r.churchId)))) {
    const d = (r.formData ?? {}) as Record<string, string>;
    rows.push(line("Church", "", r.churchId ?? "", d.churchName ?? "", "", r.category, "Registered", r));
  }
  for (const r of regs.filter((r) => r.type === "INDIVIDUAL")) {
    rows.push(line(
      r.category === "overseas" ? "Individual (Overseas)" : "Individual",
      "", "", personName(r), "", r.category, isCancelled(r) ? "Cancelled" : "Registered", r
    ));
  }

  const all = [headers, ...rows];
  const filename = `full-status-${Date.now()}.${format}`;
  return format === "xlsx"
    ? fileResponse(toXLSX(all, "Full Status"), filename, format)
    : fileResponse(Buffer.from(toCSV(all)), filename, format);
}

async function galaReport(format: Format) {
  const regs = await prisma.registration.findMany({
    where: { event: { slug: GALA_EVENT_SLUG } },
    include: { payments: true, attendees: true },
    orderBy: { createdAt: "asc" },
  });

  const headers = [
    "Registration ID", "Ticket Type", "Name", "Church / Organisation", "Email", "Phone",
    "Seats", "Registration Status", "Names Submitted", "Fee (FJD)", "Paid (FJD)",
    "Balance (FJD)", "Payment Status", "Payment Method", "Registered On",
  ];
  const rows = regs.map((r) => {
    const d = (r.formData ?? {}) as Record<string, string>;
    const paid = confirmedPaid(r);
    const cancelled = isCancelled(r);
    return [
      r.registrationId,
      r.category === "gala-table" ? "Table" : "Seat",
      personName(r),
      d.church || d.churchName || "",
      r.email, r.phone ?? "", r.numberOfAttendees,
      cancelled ? "Cancelled" : "Registered",
      r.attendees.length,
      r.fee.toFixed(2), paid.toFixed(2), (r.fee - paid).toFixed(2),
      cancelled && paid <= 0 ? "Cancelled" : paymentLabel(r.fee, paid),
      r.paymentMethod,
      r.createdAt.toISOString().slice(0, 10),
    ];
  });

  const all = [headers, ...rows];
  const filename = `gala-${Date.now()}.${format}`;
  return format === "xlsx"
    ? fileResponse(toXLSX(all, "Gala Dinner"), filename, format)
    : fileResponse(Buffer.from(toCSV(all)), filename, format);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "registrations") as ReportType;
  const format = (searchParams.get("format") ?? "csv") as Format;
  const dateRange = searchParams.get("dateRange") ?? "all";
  const category = searchParams.get("category") ?? "all";

  const dateFrom = dateRangeFilter(dateRange);

  try {
    switch (type) {
      case "registrations": return await registrationsReport(format, dateFrom, category);
      case "payments":      return await paymentsReport(format, dateFrom, category);
      case "venues":        return await venuesReport(format);
      case "categories":    return await categoriesReport(format, dateFrom);
      case "checkin":       return await checkinReport(format, dateFrom);
      case "churches":      return await churchesReport(format, dateFrom);
      case "attendees":     return await attendeesReport(format, dateFrom, category);
      case "ledger":        return await ledgerReport(format);
      case "full-status":   return await fullStatusReport(format);
      case "gala":          return await galaReport(format);
      default:              return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
