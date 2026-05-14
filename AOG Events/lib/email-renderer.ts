import { EmailTemplateContent } from "./email-defaults";

export function substituteVariables(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// Inject email-safe inline styles into TipTap-generated semantic HTML
export function toEmailHtml(html: string): string {
  return html
    // Paragraphs — plain and with alignment
    .replace(
      /<p style="text-align:\s*(\w+)">/g,
      '<p style="margin:0 0 14px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.6;text-align:$1;">'
    )
    .replace(/<p>/g, '<p style="margin:0 0 14px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.6;">')
    // Headings
    .replace(
      /<h1 style="text-align:\s*(\w+)">/g,
      '<h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#ffffff;text-align:$1;">'
    )
    .replace(/<h1>/g, '<h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#ffffff;">')
    .replace(
      /<h2 style="text-align:\s*(\w+)">/g,
      '<h2 style="margin:0 0 14px;font-size:18px;font-weight:700;color:#ffffff;text-align:$1;">'
    )
    .replace(/<h2>/g, '<h2 style="margin:0 0 14px;font-size:18px;font-weight:700;color:#ffffff;">')
    .replace(
      /<h3 style="text-align:\s*(\w+)">/g,
      '<h3 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#ffffff;text-align:$1;">'
    )
    .replace(/<h3>/g, '<h3 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#ffffff;">')
    // Inline formatting
    .replace(/<strong>/g, '<strong style="color:#ffffff;font-weight:700;">')
    .replace(/<em>/g, '<em style="font-style:italic;">')
    // Links — preserve existing href/target attributes
    .replace(/<a /g, '<a style="color:#FF6C00;text-decoration:underline;" ')
    // Lists
    .replace(/<ul>/g, '<ul style="margin:0 0 14px;padding-left:20px;color:rgba(255,255,255,0.7);">')
    .replace(/<ol>/g, '<ol style="margin:0 0 14px;padding-left:20px;color:rgba(255,255,255,0.7);">')
    .replace(/<li>/g, '<li style="margin-bottom:6px;">');
}

export const emailWrapper = (body: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
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
        <tr>
          <td style="background:#161616;padding:36px 40px;border-radius:0 0 12px 12px;">
            ${body}
          </td>
        </tr>
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

export const pill = (label: string, value: string) => `
  <tr>
    <td style="padding:6px 0;font-size:13px;color:rgba(255,255,255,0.5);width:160px;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#ffffff;font-weight:600;">${value}</td>
  </tr>`;

export const divider = () =>
  `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;">`;

export const orangeButton = (href: string, text: string) => `
  <a href="${href}" style="display:inline-block;background:#FF6C00;color:#ffffff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
    ${text}
  </a>`;

export function renderEmailTemplate(
  content: EmailTemplateContent,
  vars: Record<string, string>,
  dataBlocks: string[] = [],
  ticketsHtml?: string
): { subject: string; html: string } {
  const s = (str: string) => substituteVariables(str, vars);

  const tagline = content.preHeading
    ? `<p style="margin:0 0 6px;font-size:13px;color:#FF6C00;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">${s(content.preHeading)}</p>`
    : "";

  const heading = content.heading
    ? `<h1 style="margin:0 0 24px;font-size:24px;font-weight:800;color:#ffffff;">${s(content.heading)}</h1>`
    : "";

  const body = content.bodyHtml
    ? `<div style="margin:0 0 24px;">${s(toEmailHtml(content.bodyHtml))}</div>`
    : "";

  const closing = content.closingHtml
    ? `${divider()}<div style="font-size:14px;line-height:1.6;">${s(toEmailHtml(content.closingHtml))}</div>`
    : "";

  const cta =
    content.ctaText && content.ctaUrl
      ? `<div style="margin:24px 0;">${orangeButton(s(content.ctaUrl), s(content.ctaText))}</div>`
      : "";

  const fullBody = [tagline, heading, body, ...dataBlocks, ticketsHtml ?? "", closing, cta]
    .filter(Boolean)
    .join("\n");

  return {
    subject: s(content.subject),
    html: emailWrapper(fullBody),
  };
}
