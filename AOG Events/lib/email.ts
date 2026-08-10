import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TEMPLATES, EmailTemplateContent, TemplateName } from "./email-defaults";
import { renderEmailTemplate, pill, divider } from "./email-renderer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function loadTemplate(name: TemplateName): Promise<EmailTemplateContent> {
  try {
    const row = await prisma.emailTemplate.findUnique({ where: { id: name } });
    if (row) {
      return {
        subject: row.subject,
        preHeading: row.preHeading,
        heading: row.heading,
        bodyHtml: row.bodyHtml,
        ctaText: row.ctaText,
        ctaUrl: row.ctaUrl,
        closingHtml: row.closingHtml,
      };
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_TEMPLATES[name];
}

// ── Multi-page ticket PDF (one page per ticket) ──────────────────────────────

interface TicketPageParams {
  ticketNumber: string;
  ticketType: "ADULT" | "YOUTH";
  registrationId: string;
  // The specific named attendee this ticket was issued for, when known;
  // falls back to the registrant/pastor name for admin-bulk-imported or
  // legacy registrations with no linked Attendee.
  attendeeName: string;
  category: string;
  registrationType: string;
  churchName?: string;
  district?: string;
  country?: string;
  paymentStatusLabel: string;
  eventName: string;
  eventDate: string;
  venueName: string;
  venueCity: string;
  qrBuffer: Buffer;
  pageNumber: number;
  totalPages: number;
}

// Adult = brand orange, Youth = brand yellow/gold — matches the client's
// "badge colour-coding" requirement. Kids don't get tickets, so no color yet.
const TICKET_ACCENT_COLORS = {
  ADULT: rgb(1, 0.42, 0),
  YOUTH: rgb(1, 0.949, 0),
} as const;

async function addTicketPage(pdfDoc: PDFDocument, p: TicketPageParams) {
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { height } = page.getSize();

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const accentColor = TICKET_ACCENT_COLORS[p.ticketType];

  const label = (text: string, x: number, y: number) =>
    page.drawText(text, { x, y, size: 9, font: regular, color: rgb(0.44, 0.5, 0.59) });
  const value = (text: string, x: number, y: number, size = 13, color = rgb(0.1, 0.13, 0.17)) =>
    page.drawText(text, { x, y, size, font: bold, color });

  // Header
  page.drawText("AOG FIJI 100TH ANNIVERSARY", {
    x: 50, y: height - 70, size: 22, font: bold, color: rgb(0.1, 0.13, 0.17),
  });
  page.drawText(`${p.ticketType === "ADULT" ? "Adult" : "Youth"} Entry Ticket`, {
    x: 50, y: height - 94, size: 13, font: bold, color: accentColor,
  });

  // Page counter (e.g. "Ticket 2 of 4")
  page.drawText(`Ticket ${p.pageNumber} of ${p.totalPages}`, {
    x: 490, y: height - 70, size: 9, font: regular, color: rgb(0.6, 0.65, 0.72),
  });

  // Accent bar, color-coded by ticket type
  page.drawRectangle({ x: 50, y: height - 103, width: 495, height: 3, color: accentColor });

  // Ticket box border
  page.drawRectangle({
    x: 50, y: height - 540, width: 495, height: 420,
    borderColor: rgb(0.85, 0.88, 0.92), borderWidth: 1,
  });

  // Left column: ticket details
  label("REGISTRATION ID", 75, height - 150);
  value(p.registrationId, 75, height - 168, 18);

  label("TICKET NUMBER", 75, height - 205);
  value(p.ticketNumber, 75, height - 223, 15);

  label("ATTENDEE", 75, height - 255);
  value(p.attendeeName, 75, height - 273);

  label("CATEGORY", 75, height - 305);
  value(p.category.replace(/-/g, " ").toUpperCase(), 75, height - 323, 11);

  // Right column: QR code
  const qrImage = await pdfDoc.embedPng(p.qrBuffer);
  page.drawImage(qrImage, { x: 360, y: height - 370, width: 155, height: 155 });
  page.drawText("SCAN AT CHECK-IN", {
    x: 360, y: height - 385, size: 8, font: regular,
    color: rgb(0.44, 0.5, 0.59), maxWidth: 155,
  });

  // Additional registration info, below the registration ID / ticket number /
  // attendee / category column. Church/district/country are omitted for
  // Individual and Overseas Delegate tickets (no Church relation).
  label("TYPE", 75, height - 355);
  value(p.registrationType, 75, height - 373, 11);

  if (p.churchName) {
    label("CHURCH", 75, height - 405);
    value(p.churchName, 75, height - 423, 11);
  }

  const districtCountry = [p.district, p.country].filter(Boolean).join(", ");
  if (districtCountry) {
    label("DISTRICT / COUNTRY", 75, height - 455);
    value(districtCountry, 75, height - 473, 11);
  }

  label("PAYMENT STATUS", 75, height - 505);
  value(p.paymentStatusLabel, 75, height - 523, 11);

  // Event details
  page.drawText("Event Details", { x: 50, y: height - 575, size: 11, font: bold, color: rgb(0.1, 0.13, 0.17) });
  label(p.eventName, 50, height - 593);
  const venue = [p.venueName, p.venueCity].filter(Boolean).join(", ");
  if (venue) {
    label("VENUE", 50, height - 611);
    value(venue, 50, height - 627, 13, accentColor);
    if (p.eventDate) label(`Date: ${p.eventDate}`, 50, height - 645);
  } else if (p.eventDate) {
    label(`Date: ${p.eventDate}`, 50, height - 609);
  }

  // Footer
  page.drawText(
    "This ticket is non-transferable. Present this ticket with a valid ID at the registration desk. One scan per ticket.",
    { x: 50, y: height - 675, size: 8, font: regular, color: rgb(0.6, 0.65, 0.72), maxWidth: 495 }
  );
}

async function generateTicketsPdf(
  tickets: { ticketNumber: string; ticketType: "ADULT" | "YOUTH"; attendeeName: string; venueName: string; venueCity: string; qrBuffer: Buffer }[],
  shared: Omit<TicketPageParams, "ticketNumber" | "ticketType" | "attendeeName" | "venueName" | "venueCity" | "qrBuffer" | "pageNumber" | "totalPages">
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < tickets.length; i++) {
    await addTicketPage(pdfDoc, {
      ...shared,
      ticketNumber: tickets[i].ticketNumber,
      ticketType: tickets[i].ticketType,
      attendeeName: tickets[i].attendeeName,
      venueName: tickets[i].venueName,
      venueCity: tickets[i].venueCity,
      qrBuffer: tickets[i].qrBuffer,
      pageNumber: i + 1,
      totalPages: tickets.length,
    });
  }

  return Buffer.from(await pdfDoc.save());
}

// ── 1. Registrant pending email (bank transfer submitted) ────────────────────

interface PendingEmailParams {
  to: string;
  registrantName: string;
  registrationId: string;
  category: string;
  numberOfTickets: number;
  fee: number;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranch: string;
  eventName: string;
  paymentType?: string;
  installmentCount?: number | null;
  installmentDeadline?: string;
}

export async function sendPendingRegistrationEmail(p: PendingEmailParams) {
  const template = await loadTemplate("pending_registration");

  const vars: Record<string, string> = {
    registrantName: p.registrantName,
    registrationId: p.registrationId,
    category: p.category,
    numberOfTickets: String(p.numberOfTickets),
    fee: `$${p.fee.toFixed(2)}`,
    bankName: p.bankName || "—",
    bankAccountName: p.bankAccountName || "—",
    bankAccountNumber: p.bankAccountNumber || "—",
    bankBranch: p.bankBranch || "",
    eventName: p.eventName,
    paymentType: p.paymentType ?? "full",
    installmentCount: p.installmentCount ? String(p.installmentCount) : "",
    installmentDeadline: p.installmentDeadline ?? "30 September 2026",
  };

  const dataBlocks: string[] = [
    `<table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;">
      ${pill("Registration ID", p.registrationId)}
      ${pill("Category", p.category)}
      ${pill("Tickets", String(p.numberOfTickets))}
      ${pill("Total (FJD)", `$${p.fee.toFixed(2)}`)}
    </table>`,
  ];

  if (p.bankAccountNumber) {
    dataBlocks.push(`
      ${divider()}
      <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#ffffff;">Bank Transfer Details</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;border:1px solid rgba(255,108,0,0.2);">
        ${pill("Bank", p.bankName || "—")}
        ${pill("Account Name", p.bankAccountName || "—")}
        ${pill("Account No.", p.bankAccountNumber || "—")}
        ${p.bankBranch ? pill("Branch / BSB", p.bankBranch) : ""}
        ${pill("Amount (FJD)", `$${p.fee.toFixed(2)}`)}
        ${pill("Reference", p.registrationId)}
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">
        ⚠ Please use your Registration ID <strong style="color:#ffffff;">${p.registrationId}</strong> as the payment reference so we can match your transfer.
      </p>
    `);
  }

  const { subject, html } = renderEmailTemplate(template, vars, dataBlocks);
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: p.to, subject, html,
  });
}

// ── 2. Admin notification email (new bank transfer pending) ──────────────────

interface AdminNotificationParams {
  to: string;
  registrantName: string;
  registrantEmail: string;
  registrationId: string;
  category: string;
  numberOfTickets: number;
  fee: number;
  eventName: string;
  adminUrl: string;
}

export async function sendAdminNotificationEmail(p: AdminNotificationParams) {
  const template = await loadTemplate("admin_notification");

  const vars: Record<string, string> = {
    registrantName: p.registrantName,
    registrantEmail: p.registrantEmail,
    registrationId: p.registrationId,
    category: p.category,
    numberOfTickets: String(p.numberOfTickets),
    fee: `$${p.fee.toFixed(2)}`,
    eventName: p.eventName,
    adminUrl: p.adminUrl,
  };

  const dataBlocks = [
    `<table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;">
      ${pill("Registration ID", p.registrationId)}
      ${pill("Registrant", p.registrantName)}
      ${pill("Email", p.registrantEmail)}
      ${pill("Category", p.category)}
      ${pill("Tickets", String(p.numberOfTickets))}
      ${pill("Amount (FJD)", `$${p.fee.toFixed(2)}`)}
      ${pill("Event", p.eventName)}
    </table>`,
  ];

  const { subject, html } = renderEmailTemplate(template, vars, dataBlocks);
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: p.to, subject, html,
  });
}

// ── 3. Ticket confirmation email (sent on admin approval) ────────────────────

interface TicketEmailParams {
  to: string;
  registrantName: string;
  registrationId: string;
  category: string;
  registrationType: string;
  churchName?: string;
  district?: string;
  country?: string;
  paymentStatusLabel: string;
  eventName: string;
  eventDate: string;
  venueName: string;
  venueCity: string;
  tickets: { ticketNumber: string; ticketType: "ADULT" | "YOUTH"; attendeeName?: string; venueName?: string; venueCity?: string }[];
  appUrl: string;
}

export async function sendTicketConfirmationEmail(p: TicketEmailParams) {
  const template = await loadTemplate("ticket_confirmation");

  // Generate a QR PNG buffer for every ticket in parallel
  const ticketAssets = await Promise.all(
    p.tickets.map(async (t) => ({
      ticketNumber: t.ticketNumber,
      ticketType: t.ticketType,
      attendeeName: t.attendeeName || p.registrantName,
      venueName: t.venueName ?? p.venueName,
      venueCity: t.venueCity ?? p.venueCity,
      qrBuffer: await QRCode.toBuffer(t.ticketNumber, {
        width: 400,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      }),
    }))
  );

  // Build a single multi-page PDF (one page per ticket)
  const pdfBuffer = await generateTicketsPdf(ticketAssets, {
    registrationId: p.registrationId,
    category: p.category,
    registrationType: p.registrationType,
    churchName: p.churchName,
    district: p.district,
    country: p.country,
    paymentStatusLabel: p.paymentStatusLabel,
    eventName: p.eventName,
    eventDate: p.eventDate,
  });

  const ticketsHtml = `
    <div style="background:#1e1e1e;border-radius:8px;padding:20px;text-align:center;">
      <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#ffffff;">
        ${p.tickets.length} Ticket${p.tickets.length !== 1 ? "s" : ""} Attached
      </p>
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">
        Open the attached PDF to view and print your QR code tickets.<br>
        Present each QR code at the venue entrance for check-in.
      </p>
    </div>
  `;

  const vars: Record<string, string> = {
    registrantName: p.registrantName,
    registrationId: p.registrationId,
    category: p.category,
    eventName: p.eventName,
    eventDate: p.eventDate,
    venueName: p.venueName,
    venueCity: p.venueCity,
    supportEmail: (await prisma.siteConfig.findUnique({ where: { id: "default" } }))?.notificationEmail ?? process.env.SMTP_FROM_EMAIL ?? "",
  };

  const dataBlocks = [
    `<table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;margin-bottom:24px;">
      ${pill("Registration ID", p.registrationId)}
      ${pill("Category", p.category)}
      ${p.churchName ? pill("Church", p.churchName) : ""}
      ${pill("Payment Status", p.paymentStatusLabel)}
      ${pill("Event", p.eventName)}
      ${pill("Date", p.eventDate)}
      ${pill("Venue", [p.venueName, p.venueCity].filter(Boolean).join(", "))}
    </table>`,
  ];

  const { subject, html } = renderEmailTemplate(template, vars, dataBlocks, ticketsHtml);

  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: p.to,
    subject,
    html,
    attachments: [
      {
        filename: `AOG-Tickets-${p.registrationId}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}

// ── Finance ledger notifications ──────────────────────────────────────────

interface FinanceNotificationParams {
  to: string;
  registrationId: string;
  registrantName: string;
  amount: number;
  totalPaid: number;
  remainingBalance: number;
  confirmedByName: string;
}

export async function sendFinanceNotificationEmail(p: FinanceNotificationParams) {
  const template = await loadTemplate("finance_payment_logged");

  const vars: Record<string, string> = {
    registrationId: p.registrationId,
    registrantName: p.registrantName,
    amount: `$${p.amount.toFixed(2)}`,
    totalPaid: `$${p.totalPaid.toFixed(2)}`,
    remainingBalance: `$${p.remainingBalance.toFixed(2)}`,
    confirmedByName: p.confirmedByName,
  };

  const dataBlocks: string[] = [
    `<table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;">
      ${pill("Registration", p.registrationId)}
      ${pill("Church / Individual", p.registrantName)}
      ${pill("Amount Logged", `$${p.amount.toFixed(2)}`)}
      ${pill("Total Paid", `$${p.totalPaid.toFixed(2)}`)}
      ${pill("Remaining Balance", `$${p.remainingBalance.toFixed(2)}`)}
      ${pill("Confirmed By", p.confirmedByName)}
    </table>`,
  ];

  const { subject, html } = renderEmailTemplate(template, vars, dataBlocks);
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: p.to, subject, html,
  });
}

// ── Password reset email ──────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#0a0a0a;font-family:sans-serif;">
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#0a0a0a;padding:40px 20px;">
        <tr><td align="center">
          <table cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">
            <tr><td style="padding-bottom:32px;text-align:center;">
              <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">AOG Fiji 100th</span>
            </td></tr>
            <tr><td style="background:#141414;border-radius:12px;padding:40px;border:1px solid rgba(255,255,255,0.08);">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">Reset your password</h1>
              <p style="margin:0 0 28px;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
                We received a request to reset your admin password. Click the button below to choose a new one.
              </p>
              <a href="${resetUrl}" style="display:inline-block;background:#ff6c00;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;">
                Reset Password
              </a>
              <p style="margin:28px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">
                This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to,
    subject: "Reset your AOG Admin password",
    html,
  });
}

interface BalanceUpdateParams {
  to: string;
  registrationId: string;
  amountReceived: number;
  totalPaid: number;
  remainingBalance: number;
  fullyPaid: boolean;
}

export async function sendBalanceUpdateEmail(p: BalanceUpdateParams) {
  const template = await loadTemplate("balance_update");

  const vars: Record<string, string> = {
    registrationId: p.registrationId,
    amountReceived: `$${p.amountReceived.toFixed(2)}`,
    totalPaid: `$${p.totalPaid.toFixed(2)}`,
    remainingBalance: `$${p.remainingBalance.toFixed(2)}`,
    statusNote: p.fullyPaid
      ? "Your registration is now fully paid — your entry QR tickets are on their way in a separate email."
      : "Thank you — we'll let you know once your registration is fully paid.",
  };

  const dataBlocks: string[] = [
    `<table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;">
      ${pill("Registration", p.registrationId)}
      ${pill("Amount Received", `$${p.amountReceived.toFixed(2)}`)}
      ${pill("Total Paid", `$${p.totalPaid.toFixed(2)}`)}
      ${pill("Remaining Balance", `$${p.remainingBalance.toFixed(2)}`)}
    </table>`,
  ];

  const { subject, html } = renderEmailTemplate(template, vars, dataBlocks);
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: p.to, subject, html,
  });
}
