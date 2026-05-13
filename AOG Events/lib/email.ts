import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function send(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
}

// ── Shared styles ────────────────────────────────────────────────────────────

const emailWrapper = (body: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#111111;border-radius:12px 12px 0 0;padding:32px;text-align:center;border-bottom:3px solid #FF6C00;">
            <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:8px;">
              Assemblies of God · Fiji · Est. 1926
            </div>
            <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.05em;">
              AOG FIJI 100<span style="color:#FF6C00;">th</span>
            </div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#161616;padding:36px 40px;border-radius:0 0 12px 12px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px;text-align:center;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);">
              © 2026 Assemblies of God, Fiji. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const pill = (label: string, value: string) => `
  <tr>
    <td style="padding:6px 0;font-size:13px;color:rgba(255,255,255,0.5);width:160px;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#ffffff;font-weight:600;">${value}</td>
  </tr>`;

const divider = () =>
  `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;">`;

const orangeButton = (href: string, text: string) => `
  <a href="${href}" style="display:inline-block;background:#FF6C00;color:#ffffff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
    ${text}
  </a>`;

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
  const bankSection = p.bankAccountNumber
    ? `
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
    </p>`
    : "";

  const html = emailWrapper(`
    <p style="margin:0 0 6px;font-size:13px;color:#FF6C00;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Registration Received</p>
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:800;color:#ffffff;">Hi ${p.registrantName},</h1>
    <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.6;">
      Your registration for <strong style="color:#ffffff;">${p.eventName}</strong> has been received and is currently <strong style="color:#FF6C00;">pending payment verification</strong>.
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;">
      ${pill("Registration ID", p.registrationId)}
      ${pill("Category", p.category)}
      ${pill("Tickets", String(p.numberOfTickets))}
      ${pill("Total (FJD)", `$${p.fee.toFixed(2)}`)}
    </table>

    ${bankSection}

    ${divider()}
    <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6;">
      Once our team confirms your bank transfer, your tickets and QR codes will be sent to this email address. This usually takes <strong style="color:#ffffff;">1–2 business days</strong>.
    </p>
  `);

  await send(p.to, `Registration Received – ${p.registrationId}`, html);
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
  const html = emailWrapper(`
    <p style="margin:0 0 6px;font-size:13px;color:#FF6C00;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">New Remittance to Verify</p>
    <h1 style="margin:0 0 24px;font-size:22px;font-weight:800;color:#ffffff;">New Bank Transfer Registration</h1>
    <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.6;">
      A new registration has been submitted via bank transfer and is awaiting remittance verification.
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;">
      ${pill("Registration ID", p.registrationId)}
      ${pill("Registrant", p.registrantName)}
      ${pill("Email", p.registrantEmail)}
      ${pill("Category", p.category)}
      ${pill("Tickets", String(p.numberOfTickets))}
      ${pill("Amount (FJD)", `$${p.fee.toFixed(2)}`)}
      ${pill("Event", p.eventName)}
    </table>

    ${divider()}
    <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.6);">
      Please check your bank account for the transfer and approve the registration once confirmed.
    </p>
    ${orangeButton(p.adminUrl, "Go to Admin Dashboard →")}
  `);

  await send(p.to, `[Action Required] New Remittance – ${p.registrationId}`, html);
}

// ── 3. Confirmation email with tickets (sent on admin approval) ──────────────

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
  const ticketRows = p.tickets
    .map(
      (t) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:2px;">Ticket</div>
              <div style="font-size:16px;font-weight:700;color:#ffffff;font-family:monospace;">${t.ticketNumber}</div>
            </td>
            <td align="right">
              <img
                src="${p.appUrl}/api/qr/${encodeURIComponent(t.ticketNumber)}"
                alt="QR ${t.ticketNumber}"
                width="80" height="80"
                style="border-radius:6px;background:#ffffff;padding:4px;"
              />
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    )
    .join("");

  const html = emailWrapper(`
    <p style="margin:0 0 6px;font-size:13px;color:#FF6C00;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Registration Confirmed</p>
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:800;color:#ffffff;">Your Tickets are Ready! 🎉</h1>
    <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.6;">
      Hi ${p.registrantName}, your payment has been verified and your registration for <strong style="color:#ffffff;">${p.eventName}</strong> is confirmed.
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;margin-bottom:24px;">
      ${pill("Registration ID", p.registrationId)}
      ${pill("Category", p.category)}
      ${pill("Event", p.eventName)}
      ${pill("Date", p.eventDate)}
      ${pill("Venue", `${p.venueName}${p.venueCity ? `, ${p.venueCity}` : ""}`)}
    </table>

    <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#ffffff;">Your Tickets</p>
    <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.5);">
      Present each QR code at the venue entrance for check-in. Screenshot or print these for offline access.
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;overflow:hidden;">
      ${ticketRows}
    </table>

    ${divider()}
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.6;">
      If you have any questions, reply to this email or contact us at ${process.env.SMTP_FROM_EMAIL}.
    </p>
  `);

  await send(
    p.to,
    `Your Tickets – ${p.eventName} (${p.registrationId})`,
    html
  );
}
