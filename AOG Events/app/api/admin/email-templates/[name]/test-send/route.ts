import { NextResponse } from "next/server";
import { TEMPLATE_NAMES, TemplateName, EmailTemplateContent } from "@/lib/email-defaults";
import { renderEmailTemplate, pill, divider } from "@/lib/email-renderer";
import nodemailer from "nodemailer";

type Params = { params: Promise<{ name: string }> };

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const SAMPLE_VARS: Record<TemplateName, Record<string, string>> = {
  pending_registration: {
    registrantName: "John",
    recipientName: "Suva Central AG",
    churchName: "Suva Central AG",
    registrationId: "AOG100-TEST",
    category: "Large Church",
    numberOfTickets: "4",
    fee: "$120.00",
    bankName: "BSP Fiji",
    bankAccountName: "Assemblies of God Fiji",
    bankAccountNumber: "1234-567890",
    bankBranch: "Suva Main",
    eventName: "AOG Fiji 100th Anniversary",
  },
  admin_notification: {
    registrantName: "John Smith",
    registrantEmail: "john@example.com",
    registrationId: "AOG100-TEST",
    category: "Large Church",
    numberOfTickets: "4",
    fee: "$120.00",
    eventName: "AOG Fiji 100th Anniversary",
    adminUrl: "#",
  },
  ticket_confirmation: {
    registrantName: "John",
    recipientName: "Suva Central AG",
    churchName: "Suva Central AG",
    registrationId: "AOG100-TEST",
    category: "Large Church",
    eventName: "AOG Fiji 100th Anniversary",
    eventDate: "June 2026",
    venueName: "FMF Arena",
    venueCity: "Suva",
    supportEmail: process.env.SMTP_FROM_EMAIL ?? "bookings@tahitonga.com",
  },
  confirmation_pdf: {
    registrantName: "John",
    registrationId: "AOG100-TEST",
    category: "Large Church",
  },
  finance_payment_logged: {
    registrationId: "AG100-027VL301",
    amount: "$500.00",
    totalPaid: "$1,500.00",
    remainingBalance: "$8,500.00",
    confirmedByName: "Mere Tuilagi",
  },
  balance_update: {
    registrationId: "AG100-027VL301",
    amountReceived: "$500.00",
    totalPaid: "$1,500.00",
    remainingBalance: "$8,500.00",
    statusNote: "Thank you — we'll let you know once your registration is fully paid.",
  },
  registration_expiring_reminder: {
    registrantName: "John",
    recipientName: "Suva Central AG",
    churchName: "Suva Central AG",
    registrationId: "AOG100-TEST",
    category: "Large Church",
    numberOfTickets: "4",
    fee: "$120.00",
    eventName: "AOG Fiji 100th Anniversary",
  },
};

function buildDataBlocks(name: TemplateName, vars: Record<string, string>): string[] {
  const blocks: string[] = [];

  if (name === "pending_registration") {
    blocks.push(`
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;">
        ${pill("Registration ID", vars.registrationId)}
        ${pill("Category", vars.category)}
        ${pill("Tickets", vars.numberOfTickets)}
        ${pill("Total (FJD)", vars.fee)}
      </table>
      ${divider()}
      <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#ffffff;">Bank Transfer Details</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;border:1px solid rgba(255,108,0,0.2);">
        ${pill("Bank", vars.bankName)}
        ${pill("Account Name", vars.bankAccountName)}
        ${pill("Account No.", vars.bankAccountNumber)}
        ${pill("Branch / BSB", vars.bankBranch)}
        ${pill("Amount (FJD)", vars.fee)}
        ${pill("Reference", vars.registrationId)}
      </table>
    `);
  }

  if (name === "admin_notification") {
    blocks.push(`
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;">
        ${pill("Registration ID", vars.registrationId)}
        ${pill("Registrant", vars.registrantName)}
        ${pill("Email", vars.registrantEmail)}
        ${pill("Category", vars.category)}
        ${pill("Tickets", vars.numberOfTickets)}
        ${pill("Amount (FJD)", vars.fee)}
        ${pill("Event", vars.eventName)}
      </table>
    `);
  }

  if (name === "ticket_confirmation") {
    blocks.push(`
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;margin-bottom:24px;">
        ${pill("Registration ID", vars.registrationId)}
        ${pill("Category", vars.category)}
        ${pill("Event", vars.eventName)}
        ${pill("Date", vars.eventDate)}
        ${pill("Venue", `${vars.venueName}, ${vars.venueCity}`)}
      </table>
    `);
  }

  if (name === "confirmation_pdf") {
    blocks.push(`
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;margin-bottom:20px;">
        ${pill("Registration ID", vars.registrationId)}
        ${pill("Category", vars.category)}
      </table>
    `);
  }

  if (name === "registration_expiring_reminder") {
    blocks.push(`
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;">
        ${pill("Registration ID", vars.registrationId)}
        ${pill("Category", vars.category)}
        ${pill("Tickets", vars.numberOfTickets)}
        ${pill("Total (FJD)", vars.fee)}
      </table>
    `);
  }

  return blocks;
}

export async function POST(req: Request, { params }: Params) {
  const { name } = await params;
  if (!TEMPLATE_NAMES.includes(name as TemplateName)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { content, recipientEmail } = body as {
      content: EmailTemplateContent;
      recipientEmail: string;
    };

    if (!recipientEmail || !recipientEmail.includes("@")) {
      return NextResponse.json({ error: "Valid recipient email required" }, { status: 400 });
    }

    const templateName = name as TemplateName;
    const vars = SAMPLE_VARS[templateName];
    const dataBlocks = buildDataBlocks(templateName, vars);

    const { html, subject } = renderEmailTemplate(content, vars, dataBlocks);

    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to: recipientEmail,
      subject: `[TEST] ${subject}`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email template test-send error:", error);
    return NextResponse.json({ error: "Failed to send test email" }, { status: 500 });
  }
}
