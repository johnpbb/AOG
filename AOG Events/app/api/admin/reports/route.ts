import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { startOfDay, startOfWeek, startOfMonth } from "date-fns";

type Format = "csv" | "xlsx";
type ReportType =
  | "registrations"
  | "payments"
  | "venues"
  | "categories"
  | "checkin"
  | "churches"
  | "ledger";

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
      tickets: { select: { ticketNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Registration ID", "Church ID", "Type", "Category", "Name", "Email", "Phone",
    "Adults", "Youth", "Kids", "Event", "Venue", "Venue City", "Tickets", "Ticket Numbers",
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
    r.event?.name ?? "",
    r.venue?.name ?? "",
    r.venue?.city ?? "",
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
    include: { venue: { select: { name: true, city: true } } },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Church ID", "Church Name", "Denomination", "City", "Pastor Name", "Email", "Phone",
    "Category", "Adults", "Youth", "Kids", "Attendees", "Venue", "Registration ID", "Payment Status",
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
    "Registration ID", "Church", "Category", "Payment Type", "Installments",
    "Installment Deadline", "Total Fee (FJD)", "Amount Paid (FJD)", "Remaining Balance (FJD)", "Status",
  ];

  const rows = regs.map((r) => {
    const amountPaid = r.payments.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + p.amount, 0);
    return [
      r.registrationId,
      r.church?.name ?? "",
      r.category,
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

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
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
      case "ledger":        return await ledgerReport(format);
      default:              return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
