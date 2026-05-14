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
  registrationId: string;
  registrantName: string;
  category: string;
  eventName: string;
  eventDate: string;
  venueName: string;
  venueCity: string;
  qrBuffer: Buffer;
  pageNumber: number;
  totalPages: number;
}

async function addTicketPage(pdfDoc: PDFDocument, p: TicketPageParams) {
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { height } = page.getSize();

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const label = (text: string, x: number, y: number) =>
    page.drawText(text, { x, y, size: 9, font: regular, color: rgb(0.44, 0.5, 0.59) });
  const value = (text: string, x: number, y: number, size = 13) =>
    page.drawText(text, { x, y, size, font: bold, color: rgb(0.1, 0.13, 0.17) });

  // Header
  page.drawText("AOG FIJI 100TH ANNIVERSARY", {
    x: 50, y: height - 70, size: 22, font: bold, color: rgb(0.1, 0.13, 0.17),
  });
  page.drawText("Official Event Ticket", {
    x: 50, y: height - 94, size: 13, font: regular, color: rgb(0.39, 0.45, 0.55),
  });

  // Page counter (e.g. "Ticket 2 of 4")
  page.drawText(`Ticket ${p.pageNumber} of ${p.totalPages}`, {
    x: 490, y: height - 70, size: 9, font: regular, color: rgb(0.6, 0.65, 0.72),
  });

  // Orange accent bar
  page.drawRectangle({ x: 50, y: height - 103, width: 495, height: 3, color: rgb(1, 0.42, 0) });

  // Ticket box border
  page.drawRectangle({
    x: 50, y: height - 420, width: 495, height: 300,
    borderColor: rgb(0.85, 0.88, 0.92), borderWidth: 1,
  });

  // Left column: ticket details
  label("REGISTRATION ID", 75, height - 150);
  value(p.registrationId, 75, height - 168, 18);

  label("TICKET NUMBER", 75, height - 205);
  value(p.ticketNumber, 75, height - 223, 15);

  label("ATTENDEE", 75, height - 255);
  value(p.registrantName, 75, height - 273);

  label("CATEGORY", 75, height - 305);
  value(p.category.replace(/-/g, " ").toUpperCase(), 75, height - 323, 11);

  // Right column: QR code
  const qrImage = await pdfDoc.embedPng(p.qrBuffer);
  page.drawImage(qrImage, { x: 360, y: height - 370, width: 155, height: 155 });
  page.drawText("SCAN AT CHECK-IN", {
    x: 360, y: height - 385, size: 8, font: regular,
    color: rgb(0.44, 0.5, 0.59), maxWidth: 155,
  });

  // Event details
  page.drawText("Event Details", { x: 50, y: height - 460, size: 11, font: bold, color: rgb(0.1, 0.13, 0.17) });
  label(p.eventName, 50, height - 478);
  const venue = [p.venueName, p.venueCity].filter(Boolean).join(", ");
  if (venue) label(venue, 50, height - 494);
  if (p.eventDate) label(`Date: ${p.eventDate}`, 50, height - 510);

  // Footer
  page.drawText(
    "This ticket is non-transferable. Present this ticket with a valid ID at the registration desk. One scan per ticket.",
    { x: 50, y: height - 560, size: 8, font: regular, color: rgb(0.6, 0.65, 0.72), maxWidth: 495 }
  );
}

async function generateTicketsPdf(
  tickets: { ticketNumber: string; qrBuffer: Buffer }[],
  shared: Omit<TicketPageParams, "ticketNumber" | "qrBuffer" | "pageNumber" | "totalPages">
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < tickets.length; i++) {
    await addTicketPage(pdfDoc, {
      ...shared,
      ticketNumber: tickets[i].ticketNumber,
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
  eventName: string;
  eventDate: string;
  venueName: string;
  venueCity: string;
  tickets: { ticketNumber: string }[];
  appUrl: string;
}

export async function sendTicketConfirmationEmail(p: TicketEmailParams) {
  const template = await loadTemplate("ticket_confirmation");

  // Generate a QR PNG buffer for every ticket in parallel
  const ticketAssets = await Promise.all(
    p.tickets.map(async (t) => ({
      ticketNumber: t.ticketNumber,
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
    registrantName: p.registrantName,
    category: p.category,
    eventName: p.eventName,
    eventDate: p.eventDate,
    venueName: p.venueName,
    venueCity: p.venueCity,
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
    supportEmail: process.env.SMTP_FROM_EMAIL ?? "",
  };

  const dataBlocks = [
    `<table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;margin-bottom:24px;">
      ${pill("Registration ID", p.registrationId)}
      ${pill("Category", p.category)}
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
