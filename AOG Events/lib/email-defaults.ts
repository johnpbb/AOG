export type TemplateName =
  | "pending_registration"
  | "admin_notification"
  | "ticket_confirmation"
  | "confirmation_pdf";

export const TEMPLATE_NAMES: TemplateName[] = [
  "pending_registration",
  "admin_notification",
  "ticket_confirmation",
  "confirmation_pdf",
];

export interface EmailTemplateContent {
  subject: string;
  preHeading: string;
  heading: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  closingHtml: string;
}

export interface TemplateVariable {
  name: string;
  description: string;
  sample: string;
}

export interface TemplateMeta {
  label: string;
  description: string;
  variables: TemplateVariable[];
}

export const TEMPLATE_META: Record<TemplateName, TemplateMeta> = {
  pending_registration: {
    label: "Registration Received",
    description: "Sent to registrant when a bank transfer registration is submitted.",
    variables: [
      { name: "registrantName", description: "Registrant's name", sample: "John" },
      { name: "registrationId", description: "Registration ID", sample: "AOG100-0001" },
      { name: "category", description: "Category label", sample: "Large Church" },
      { name: "numberOfTickets", description: "Number of tickets", sample: "4" },
      { name: "fee", description: "Total fee (FJD)", sample: "$120.00" },
      { name: "bankName", description: "Bank name", sample: "BSP Fiji" },
      { name: "bankAccountName", description: "Account name", sample: "AOG Fiji" },
      { name: "bankAccountNumber", description: "Account number", sample: "1234-567890" },
      { name: "bankBranch", description: "Branch / BSB", sample: "Suva Main" },
      { name: "eventName", description: "Event name", sample: "AOG Fiji 100th Anniversary" },
    ],
  },
  admin_notification: {
    label: "Admin — New Bank Transfer",
    description: "Sent to admin when a new bank transfer needs verification.",
    variables: [
      { name: "registrantName", description: "Registrant full name", sample: "John Smith" },
      { name: "registrantEmail", description: "Registrant email", sample: "john@example.com" },
      { name: "registrationId", description: "Registration ID", sample: "AOG100-0001" },
      { name: "category", description: "Category label", sample: "Large Church" },
      { name: "numberOfTickets", description: "Number of tickets", sample: "4" },
      { name: "fee", description: "Total fee (FJD)", sample: "$120.00" },
      { name: "eventName", description: "Event name", sample: "AOG Fiji 100th Anniversary" },
      { name: "adminUrl", description: "Admin dashboard URL", sample: "https://example.com/admin" },
    ],
  },
  ticket_confirmation: {
    label: "Ticket Confirmation",
    description: "Sent to registrant when admin approves their bank transfer.",
    variables: [
      { name: "registrantName", description: "Registrant's name", sample: "John" },
      { name: "registrationId", description: "Registration ID", sample: "AOG100-0001" },
      { name: "category", description: "Category label", sample: "Large Church" },
      { name: "eventName", description: "Event name", sample: "AOG Fiji 100th Anniversary" },
      { name: "eventDate", description: "Event date", sample: "June 2026" },
      { name: "venueName", description: "Venue name", sample: "FMF Arena" },
      { name: "venueCity", description: "Venue city", sample: "Suva" },
      { name: "supportEmail", description: "Support email address", sample: "bookings@tahitonga.com" },
      { name: "ticketsHtml", description: "Ticket list with QR codes — auto-inserted by system", sample: "" },
    ],
  },
  confirmation_pdf: {
    label: "Online Payment Confirmation",
    description: "Sent after successful online payment (includes PDF ticket attachment).",
    variables: [
      { name: "registrantName", description: "Registrant's name", sample: "John" },
      { name: "registrationId", description: "Registration ID", sample: "AOG100-0001" },
      { name: "category", description: "Category label", sample: "Large Church" },
    ],
  },
};

export const DEFAULT_TEMPLATES: Record<TemplateName, EmailTemplateContent> = {
  pending_registration: {
    subject: "Registration Received – {{registrationId}}",
    preHeading: "Registration Received",
    heading: "Hi {{registrantName}},",
    bodyHtml: `<p>Your registration for <strong>{{eventName}}</strong> has been received and is currently <strong>pending payment verification</strong>.</p>`,
    ctaText: "",
    ctaUrl: "",
    closingHtml: `<p>Once our team confirms your bank transfer, your tickets and QR codes will be sent to this email address. This usually takes <strong>1–2 business days</strong>.</p>`,
  },
  admin_notification: {
    subject: "[Action Required] New Remittance – {{registrationId}}",
    preHeading: "New Remittance to Verify",
    heading: "New Bank Transfer Registration",
    bodyHtml: `<p>A new registration has been submitted via bank transfer and is awaiting remittance verification.</p>`,
    ctaText: "Go to Admin Dashboard →",
    ctaUrl: "{{adminUrl}}",
    closingHtml: `<p>Please check your bank account for the transfer and approve the registration once confirmed.</p>`,
  },
  ticket_confirmation: {
    subject: "Your Tickets – {{eventName}} ({{registrationId}})",
    preHeading: "Registration Confirmed",
    heading: "Your Tickets are Ready! 🎉",
    bodyHtml: `<p>Hi <strong>{{registrantName}}</strong>, your payment has been verified and your registration for <strong>{{eventName}}</strong> is confirmed.</p>`,
    ctaText: "",
    ctaUrl: "",
    closingHtml: `<p>If you have any questions, reply to this email or contact us at <strong>{{supportEmail}}</strong>.</p>`,
  },
  confirmation_pdf: {
    subject: "Registration Confirmed - AOG Fiji 100th Celebration ({{registrationId}})",
    preHeading: "Registration Confirmed",
    heading: "Vinaka, {{registrantName}}!",
    bodyHtml: `<p>Your registration for the <strong>AOG Fiji 100th Anniversary Celebration</strong> has been confirmed.</p><p>Your QR code entry ticket is below. A PDF version has also been attached to this email.</p>`,
    ctaText: "",
    ctaUrl: "",
    closingHtml: `<p>Please present this ticket along with a valid ID at the registration desk. This ticket is non-transferable.</p>`,
  },
};
