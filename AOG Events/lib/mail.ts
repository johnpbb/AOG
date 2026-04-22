import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function generateTicketPDF(registrationId: string, name: string, category: string, qrBuffer: Buffer): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
  const { width, height } = page.getSize();
  
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Header
  page.drawText('AOG FIJI 100TH ANNIVERSARY', {
    x: 50,
    y: height - 80,
    size: 24,
    font: fontBold,
    color: rgb(0.1, 0.13, 0.17),
  });

  page.drawText('Official Event Ticket', {
    x: 50,
    y: height - 105,
    size: 16,
    font: fontRegular,
    color: rgb(0.29, 0.33, 0.41),
  });

  // Ticket Box
  page.drawRectangle({
    x: 50,
    y: height - 450,
    width: 495,
    height: 300,
    borderColor: rgb(0.88, 0.91, 0.94),
    borderWidth: 1,
  });

  // Ticket Data
  const drawLabel = (text: string, x: number, y: number) => {
    page.drawText(text, { x, y, size: 10, font: fontRegular, color: rgb(0.44, 0.5, 0.59) });
  };

  const drawValue = (text: string, x: number, y: number, size: number = 14) => {
    page.drawText(text, { x, y, size, font: fontBold, color: rgb(0.18, 0.22, 0.28) });
  };

  drawLabel('REGISTRATION ID', 80, height - 200);
  drawValue(registrationId, 80, height - 220, 20);

  drawLabel('ATTENDEE', 80, height - 260);
  drawValue(name, 80, height - 280);

  drawLabel('CATEGORY', 80, height - 320);
  drawValue(category.replace(/-/g, ' ').toUpperCase(), 80, height - 340, 12);

  // Embed QR Code
  const qrImage = await pdfDoc.embedPng(qrBuffer);
  page.drawImage(qrImage, {
    x: 350,
    y: height - 350,
    width: 150,
    height: 150,
  });

  page.drawText('SCAN AT CHECK-IN', {
    x: 350,
    y: height - 370,
    size: 8,
    font: fontRegular,
    color: rgb(0.44, 0.5, 0.59),
    maxWidth: 150,
  });

  // Footer
  page.drawText('Event Details:', { x: 50, y: height - 500, size: 12, font: fontBold });
  page.drawText('Date: June 2026', { x: 50, y: height - 520, size: 10, font: fontRegular });
  page.drawText('Location: Suva, Fiji', { x: 50, y: height - 535, size: 10, font: fontRegular });

  page.drawText('This ticket is non-transferable. Please present this ticket along with a valid ID at the registration desk. One scan per ticket.', {
    x: 50,
    y: height - 570,
    size: 8,
    font: fontRegular,
    color: rgb(0.63, 0.68, 0.75),
    maxWidth: 495,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function sendConfirmationEmail(
  to: string,
  registrationId: string,
  name: string,
  category: string
) {
  try {
    // Generate QR Code as Buffer
    const qrBuffer = await QRCode.toBuffer(registrationId, {
       width: 400,
       margin: 2,
       color: {
         dark: '#000000',
         light: '#ffffff',
       }
    });

    // Generate PDF Ticket
    const pdfBuffer = await generateTicketPDF(registrationId, name, category, qrBuffer);

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject: `Registration Confirmed - AOG Fiji 100th Celebration (${registrationId})`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #1a202c; font-size: 24px; margin-bottom: 10px;">Registration Confirmed</h1>
            <p style="color: #4a5568; font-size: 16px;">Vinaka, ${name}!</p>
          </div>
          
          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #718096; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Registration ID</p>
            <p style="margin: 5px 0 0; color: #2d3748; font-size: 20px; font-weight: bold; font-family: monospace;">${registrationId}</p>
          </div>

          <div style="text-align: center; padding: 20px; border: 1px dashed #cbd5e0; border-radius: 8px; margin-bottom: 20px;">
            <p style="color: #4a5568; font-size: 14px; margin-bottom: 15px;">Your Entry QR Code</p>
            <img src="cid:qrcode" alt="QR Code" style="width: 200px; height: 200px;" />
            <p style="color: #718096; font-size: 12px; margin-top: 15px;">A PDF version of your ticket has been attached to this email.</p>
          </div>

          <div style="margin-bottom: 20px; color: #4a5568; font-size: 14px; line-height: 1.5;">
            <p><strong>Category:</strong> ${category.replace(/-/g, ' ').toUpperCase()}</p>
            <p><strong>Event:</strong> AOG Fiji 100th Anniversary Celebration</p>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; color: #a0aec0; font-size: 12px;">
            <p>&copy; 2026 AOG Fiji. All rights reserved.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: 'qrcode.png',
          content: qrBuffer,
          cid: 'qrcode'
        },
        {
          filename: `AOG-Ticket-${registrationId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Confirmation email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return { success: false, error };
  }
}
