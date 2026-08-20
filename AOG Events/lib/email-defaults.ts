export type TemplateName =
  | "pending_registration"
  | "admin_notification"
  | "ticket_confirmation"
  | "confirmation_pdf"
  | "finance_payment_logged"
  | "balance_update";

export const TEMPLATE_NAMES: TemplateName[] = [
  "pending_registration",
  "admin_notification",
  "ticket_confirmation",
  "confirmation_pdf",
  "finance_payment_logged",
  "balance_update",
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
      { name: "recipientName", description: "Church name for church registrations, otherwise the registrant's name — use this for the greeting", sample: "Suva Central AG" },
      { name: "churchName", description: "Church name (blank for Individual/Overseas)", sample: "Suva Central AG" },
      { name: "registrationId", description: "Registration ID", sample: "AOG100-0001" },
      { name: "category", description: "Category label", sample: "Large Church" },
      { name: "numberOfTickets", description: "Number of tickets", sample: "4" },
      { name: "fee", description: "Total fee (FJD)", sample: "$120.00" },
      { name: "bankName", description: "Bank name", sample: "BSP Fiji" },
      { name: "bankAccountName", description: "Account name", sample: "AOG Fiji" },
      { name: "bankAccountNumber", description: "Account number", sample: "1234-567890" },
      { name: "bankBranch", description: "Branch / BSB", sample: "Suva Main" },
      { name: "eventName", description: "Event name", sample: "AOG Fiji 100th Anniversary" },
      { name: "paymentType", description: "full or partial", sample: "partial" },
      { name: "installmentCount", description: "Number of installments chosen (if partial)", sample: "6" },
      { name: "installmentDeadline", description: "Final installment deadline", sample: "30 September 2026" },
    ],
  },
  admin_notification: {
    label: "Admin — New Bank Transfer",
    description: "Sent to admin when a new bank transfer needs verification.",
    variables: [
      { name: "registrantName", description: "Registrant full name", sample: "John Smith" },
      { name: "churchName", description: "Church name (blank for Individual/Overseas)", sample: "Suva Central AG" },
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
      { name: "recipientName", description: "Church name for church registrations, otherwise the registrant's name — use this for the greeting", sample: "Suva Central AG" },
      { name: "churchName", description: "Church name (blank for Individual/Overseas)", sample: "Suva Central AG" },
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
  finance_payment_logged: {
    label: "Finance — Payment Logged",
    description: "Sent to the finance mailbox the moment a staff member logs a payment entry.",
    variables: [
      { name: "registrationId", description: "Registration ID", sample: "AG100-027VL301" },
      { name: "registrantName", description: "Church or individual name on the registration", sample: "Suva Central AOG" },
      { name: "amount", description: "Amount just logged (FJD)", sample: "$500.00" },
      { name: "totalPaid", description: "Running total paid (FJD)", sample: "$1,500.00" },
      { name: "remainingBalance", description: "Remaining balance (FJD)", sample: "$8,500.00" },
      { name: "confirmedByName", description: "Staff member who logged the payment", sample: "Mere Tuilagi" },
    ],
  },
  balance_update: {
    label: "Registrant — Balance Update",
    description: "Sent to the registrant every time a payment is logged against their registration.",
    variables: [
      { name: "registrationId", description: "Registration ID", sample: "AG100-027VL301" },
      { name: "amountReceived", description: "Amount just received (FJD)", sample: "$500.00" },
      { name: "totalPaid", description: "Running total paid (FJD)", sample: "$1,500.00" },
      { name: "remainingBalance", description: "Remaining balance (FJD)", sample: "$8,500.00" },
      { name: "statusNote", description: "Status message — auto-set by the system", sample: "" },
    ],
  },
};

export const DEFAULT_TEMPLATES: Record<TemplateName, EmailTemplateContent> = {
  pending_registration: {
    subject: "Registration Received – {{registrationId}}",
    preHeading: "Registration Received",
    heading: "Hi {{recipientName}},",
    bodyHtml: `<p>Your registration for <strong>{{eventName}}</strong> has been received and is currently <strong>pending payment verification</strong>.</p>
<p><strong>1. How can I pay for my registration?</strong><br/>
Direct Bank Deposit / Internet Banking Transfer using the bank details below, or cash at your nearest AGFJ Divisional Office or Headquarters.</p>
<p><strong>2. How will HQ identify my payment?</strong><br/>
You must include your Unique Registration ID <strong>{{registrationId}}</strong> in the payment narration / reference field of your bank transfer or M-PAiSA transaction.</p>
<p><strong>3. I've paid — now what?</strong><br/>
Once the HQ Finance team manually matches your reference, you'll receive a confirmation receipt and your digital entry QR tokens by email.</p>`,
    ctaText: "",
    ctaUrl: "",
    closingHtml: `<p>If you chose a partial payment plan, all installments must be fully paid by <strong>{{installmentDeadline}}</strong>. Entry QR tokens are issued once your registration is fully paid.</p>`,
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
    bodyHtml: `<p>Hi <strong>{{recipientName}}</strong>, your payment has been verified and your registration for <strong>{{eventName}}</strong> is confirmed.</p>`,
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
  finance_payment_logged: {
    subject: "Payment Logged – {{registrationId}}",
    preHeading: "Payment Logged",
    heading: "A payment has been logged",
    bodyHtml: `<p><strong>{{confirmedByName}}</strong> logged a payment of <strong>{{amount}}</strong> against registration <strong>{{registrationId}}</strong> (<strong>{{registrantName}}</strong>).</p>`,
    ctaText: "",
    ctaUrl: "",
    closingHtml: `<p>Total paid so far: <strong>{{totalPaid}}</strong>. Remaining balance: <strong>{{remainingBalance}}</strong>.</p>`,
  },
  balance_update: {
    subject: "Payment Received – {{registrationId}}",
    preHeading: "Payment Received",
    heading: "We've received your payment",
    bodyHtml: `<p>We've recorded a payment of <strong>{{amountReceived}}</strong> against your registration <strong>{{registrationId}}</strong>.</p>`,
    ctaText: "",
    ctaUrl: "",
    closingHtml: `<p>Total paid: <strong>{{totalPaid}}</strong>. Remaining balance: <strong>{{remainingBalance}}</strong>.</p><p>{{statusNote}}</p>`,
  },
};
