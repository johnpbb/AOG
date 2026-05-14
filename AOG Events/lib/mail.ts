import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { prisma } from '@/lib/prisma';
import { DEFAULT_TEMPLATES, EmailTemplateContent } from './email-defaults';
import { renderEmailTemplate, pill } from './email-renderer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function loadTemplate(): Promise<EmailTemplateContent> {
  try {
    const row = await prisma.emailTemplate.findUnique({ where: { id: 'confirmation_pdf' } });
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
  return DEFAULT_TEMPLATES.confirmation_pdf;
}

async function generateTicketPDF(registrationId: string, name: string, category: string, qrBuffer: Buffer): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText('AOG FIJI 100TH ANNIVERSARY', {
    x: 50, y: height - 80, size: 24, font: fontBold, color: rgb(0.1, 0.13, 0.17),
  });
  page.drawText('Official Event Ticket', {
    x: 50, y: height - 105, size: 16, font: fontRegular, color: rgb(0.29, 0.33, 0.41),
  });
  page.drawRectangle({
    x: 50, y: height - 450, width: 495, height: 300,
    borderColor: rgb(0.88, 0.91, 0.94), borderWidth: 1,
  });

  const drawLabel = (text: string, x: number, y: number) =>
    page.drawText(text, { x, y, size: 10, font: fontRegular, color: rgb(0.44, 0.5, 0.59) });
  const drawValue = (text: string, x: number, y: number, size = 14) =>
    page.drawText(text, { x, y, size, font: fontBold, color: rgb(0.18, 0.22, 0.28) });

  drawLabel('REGISTRATION ID', 80, height - 200);
  drawValue(registrationId, 80, height - 220, 20);
  drawLabel('ATTENDEE', 80, height - 260);
  drawValue(name, 80, height - 280);
  drawLabel('CATEGORY', 80, height - 320);
  drawValue(category.replace(/-/g, ' ').toUpperCase(), 80, height - 340, 12);

  const qrImage = await pdfDoc.embedPng(qrBuffer);
  page.drawImage(qrImage, { x: 350, y: height - 350, width: 150, height: 150 });
  page.drawText('SCAN AT CHECK-IN', {
    x: 350, y: height - 370, size: 8, font: fontRegular,
    color: rgb(0.44, 0.5, 0.59), maxWidth: 150,
  });

  page.drawText('Event Details:', { x: 50, y: height - 500, size: 12, font: fontBold });
  page.drawText('Date: June 2026', { x: 50, y: height - 520, size: 10, font: fontRegular });
  page.drawText('Location: Suva, Fiji', { x: 50, y: height - 535, size: 10, font: fontRegular });
  page.drawText(
    'This ticket is non-transferable. Please present this ticket along with a valid ID at the registration desk. One scan per ticket.',
    { x: 50, y: height - 570, size: 8, font: fontRegular, color: rgb(0.63, 0.68, 0.75), maxWidth: 495 }
  );

  return Buffer.from(await pdfDoc.save());
}

export async function sendConfirmationEmail(
  to: string,
  registrationId: string,
  name: string,
  category: string
) {
  try {
    const qrBuffer = await QRCode.toBuffer(registrationId, {
      width: 400, margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    const pdfBuffer = await generateTicketPDF(registrationId, name, category, qrBuffer);
    const template = await loadTemplate();

    const vars: Record<string, string> = {
      registrantName: name,
      registrationId,
      category: category.replace(/-/g, ' ').toUpperCase(),
    };

    const dataBlocks = [
      `<table cellpadding="0" cellspacing="0" style="width:100%;background:#1e1e1e;border-radius:8px;padding:20px;margin-bottom:20px;">
        ${pill("Registration ID", registrationId)}
        ${pill("Category", category.replace(/-/g, ' ').toUpperCase())}
      </table>`,
      `<div style="text-align:center;padding:20px;border:1px dashed rgba(255,255,255,0.15);border-radius:8px;margin-bottom:20px;">
        <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 15px;">Your Entry QR Code</p>
        <img src="cid:qrcode" alt="QR Code" style="width:200px;height:200px;" />
        <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:15px 0 0;">A PDF version of your ticket has also been attached to this email.</p>
      </div>`,
    ];

    const { subject, html } = renderEmailTemplate(template, vars, dataBlocks);

    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html,
      attachments: [
        { filename: 'qrcode.png', content: qrBuffer, cid: 'qrcode' },
        { filename: `AOG-Ticket-${registrationId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
      ],
    });

    console.log('Confirmation email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return { success: false, error };
  }
}
