import { NextResponse } from "next/server";
import { TEMPLATE_NAMES, TemplateName, EmailTemplateContent } from "@/lib/email-defaults";
import { renderEmailTemplate, pill, divider } from "@/lib/email-renderer";

type Params = { params: Promise<{ name: string }> };

// Sample data used when previewing templates in the admin editor
const SAMPLE_VARS: Record<TemplateName, Record<string, string>> = {
  pending_registration: {
    registrantName: "John",
    registrationId: "AOG100-0001",
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
    registrationId: "AOG100-0001",
    category: "Large Church",
    numberOfTickets: "4",
    fee: "$120.00",
    eventName: "AOG Fiji 100th Anniversary",
    adminUrl: "#",
  },
  ticket_confirmation: {
    registrantName: "John",
    registrationId: "AOG100-0001",
    category: "Large Church",
    eventName: "AOG Fiji 100th Anniversary",
    eventDate: "June 2026",
    venueName: "FMF Arena",
    venueCity: "Suva",
    supportEmail: "bookings@tahitonga.com",
  },
  confirmation_pdf: {
    registrantName: "John",
    registrationId: "AOG100-0001",
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
      <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">
        ⚠ Use your Registration ID <strong style="color:#ffffff;">${vars.registrationId}</strong> as the payment reference.
      </p>
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

  if (name === "finance_payment_logged" || name === "balance_update") {
    blocks.push(`
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;">
        ${pill("Registration", vars.registrationId)}
        ${pill("Total Paid", vars.totalPaid)}
        ${pill("Remaining Balance", vars.remainingBalance)}
      </table>
    `);
  }

  return blocks;
}

function buildTicketsHtml(name: TemplateName): string {
  if (name !== "ticket_confirmation" && name !== "confirmation_pdf") return "";

  return `
    <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#ffffff;">Your Tickets</p>
    <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.5);">
      Present each QR code at the venue entrance for check-in.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td>
                <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:2px;">Ticket</div>
                <div style="font-size:16px;font-weight:700;color:#ffffff;font-family:monospace;">AOG-TKT-00001</div>
              </td>
              <td align="right">
                <div style="width:80px;height:80px;background:#333;border-radius:6px;display:flex;align-items:center;justify-content:center;">
                  <span style="font-size:10px;color:rgba(255,255,255,0.4);text-align:center;">QR Code<br>Preview</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export async function POST(req: Request, { params }: Params) {
  const { name } = await params;
  if (!TEMPLATE_NAMES.includes(name as TemplateName)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const content = body as EmailTemplateContent;
    const templateName = name as TemplateName;
    const vars = SAMPLE_VARS[templateName];
    const dataBlocks = buildDataBlocks(templateName, vars);
    const ticketsHtml = buildTicketsHtml(templateName);

    const { html, subject } = renderEmailTemplate(content, vars, dataBlocks, ticketsHtml);

    return NextResponse.json({ html, subject });
  } catch (error) {
    console.error("Email template preview error:", error);
    return NextResponse.json({ error: "Failed to render preview" }, { status: 500 });
  }
}
