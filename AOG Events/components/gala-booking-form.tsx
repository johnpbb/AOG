"use client";

import { useState } from "react";
import {
  REGISTRATION_CATEGORIES,
  GALA_SEATS_PER_TABLE,
  GALA_DETAILS,
  CategoryInfo,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { AttendeeCountStepper } from "@/components/attendee-count-stepper";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { User, CreditCard, Loader2, Armchair, Users, CalendarDays, Clock, MapPin, Shirt, Landmark, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

type BookingMode = "seat" | "table";

interface GalaBookingFormProps {
  eventId: string;
  /** Ballroom seats still unsold, or null when no ballroom venue is configured. */
  seatsRemaining: number | null;
  onSubmit: (data: Record<string, unknown>) => void;
}

const seatCategory = REGISTRATION_CATEGORIES.find((c) => c.id === "gala-seat") as CategoryInfo;
const tableCategory = REGISTRATION_CATEGORIES.find((c) => c.id === "gala-table") as CategoryInfo;

const MAX_SEATS = seatCategory.perRegCap?.adults ?? 9;
const MAX_TABLES = Math.floor((tableCategory.perRegCap?.adults ?? 100) / GALA_SEATS_PER_TABLE);

export function GalaBookingForm({ eventId, seatsRemaining, onSubmit }: GalaBookingFormProps) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<BookingMode>("seat");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    church: "",
  });
  const [seats, setSeats] = useState(1);
  const [tables, setTables] = useState(1);
  // The gala takes internet banking and M-PAiSA. Both are settled by hand by
  // HQ Finance, so this only records where to go looking for the money — it
  // doesn't change the booking flow.
  const [paymentMethod, setPaymentMethod] = useState<"bank-transfer" | "mpaisa">("bank-transfer");

  const updateFormData = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const category = mode === "seat" ? seatCategory : tableCategory;
  const totalSeats = mode === "seat" ? seats : tables * GALA_SEATS_PER_TABLE;
  const totalFee = mode === "seat" ? seatCategory.fee * seats : tableCategory.fee * tables;

  const overSeatLimit = mode === "seat" && seats > MAX_SEATS;
  const overTableLimit = mode === "table" && tables > MAX_TABLES;
  const soldOut = seatsRemaining !== null && seatsRemaining <= 0;
  const overRemaining = seatsRemaining !== null && totalSeats > seatsRemaining;

  const quantityValid =
    totalSeats > 0 && !overSeatLimit && !overTableLimit && !overRemaining && !soldOut;

  const isStep1Valid =
    Boolean(formData.firstName.trim()) &&
    Boolean(formData.lastName.trim()) &&
    formData.email.includes("@") &&
    Boolean(formData.phone.trim()) &&
    quantityValid;

  const handleSubmit = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category.id,
          type: "individual",
          eventId,
          turnstileToken,
          // The server re-derives both of these from the category — sent only
          // so the request reads the same as every other registration POST.
          fee: totalFee,
          numberOfTickets: totalSeats,
          // Authoritative quantity for the server: seats for a seat booking,
          // whole tables for a table booking.
          adults: mode === "seat" ? seats : undefined,
          tables: mode === "table" ? tables : undefined,
          paymentMethod,
          ...formData,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your booking");

      onSubmit({
        registrationId: data.registrationId,
        email: formData.email,
        fee: totalFee,
        numberOfTickets: totalSeats,
        mode,
        paymentMethod,
      });
    } catch (err: any) {
      setIsProcessing(false);
      setError(err.message);
    }
  };

  const steps = [
    { number: 1, title: "Your Details", icon: User },
    { number: 2, title: "Payment", icon: CreditCard },
  ];

  return (
    <div className="space-y-8">
      {/* Event facts — mirrors the invitation so the booking page is self-contained */}
      <div className="grid gap-3 sm:grid-cols-2 p-5 rounded-xl border-2 border-border bg-secondary/30 text-sm">
        <div className="flex items-start gap-2.5">
          <CalendarDays className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span className="text-foreground">{GALA_DETAILS.dateLabel}</span>
        </div>
        <div className="flex items-start gap-2.5">
          <Clock className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span className="text-foreground">{GALA_DETAILS.timeLabel}</span>
        </div>
        <div className="flex items-start gap-2.5">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span className="text-foreground">{GALA_DETAILS.venueName}</span>
        </div>
        <div className="flex items-start gap-2.5">
          <Shirt className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span className="text-foreground">Dress code: {GALA_DETAILS.dressCode}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, index) => (
          <div key={s.number} className="flex items-center">
            <button
              onClick={() => setStep(s.number)}
              disabled={s.number === 2 && !isStep1Valid}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                step === s.number
                  ? "bg-primary text-primary-foreground"
                  : step > s.number
                    ? "bg-green-100 text-green-700"
                    : "bg-secondary text-muted-foreground"
              )}
            >
              <s.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{s.title}</span>
            </button>
            {index < steps.length - 1 && (
              <div className={cn("w-8 h-0.5 mx-2", step > s.number ? "bg-green-500" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      {soldOut && (
        <div role="alert" className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          The gala dinner is fully booked. Please contact {GALA_DETAILS.enquiriesEmail} to join the waiting list.
        </div>
      )}

      {/* ── Step 1: booking type, quantity, buyer details ───────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-foreground">Secure Your Seats</h2>
            <p className="text-muted-foreground mt-1">
              Book individual seats or reserve a whole table for your group.
            </p>
          </div>

          {/* Seat vs table */}
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                { id: "seat" as const, icon: Armchair, title: "Individual Seat", price: "$300 FJD", per: "per person" },
                { id: "table" as const, icon: Users, title: "Table of 10", price: "$3,000 FJD", per: "per table" },
              ]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                className={cn(
                  "text-left p-5 rounded-xl border-2 transition-all",
                  mode === opt.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-secondary/30 hover:border-primary/40"
                )}
              >
                <opt.icon className={cn("h-5 w-5 mb-2", mode === opt.id ? "text-primary" : "text-muted-foreground")} />
                <div className="font-semibold text-foreground">{opt.title}</div>
                <div className="text-lg font-bold text-primary mt-1">{opt.price}</div>
                <div className="text-xs text-muted-foreground">{opt.per}</div>
              </button>
            ))}
          </div>

          {/* Quantity */}
          <div className="p-5 rounded-xl border-2 border-border bg-secondary/30 space-y-3">
            {mode === "seat" ? (
              <>
                <AttendeeCountStepper id="seats" label="Number of Seats" value={seats} onChange={setSeats} />
                {seats >= MAX_SEATS && (
                  <p className="text-xs text-muted-foreground">
                    Need {GALA_SEATS_PER_TABLE} or more? A full table costs the same as{" "}
                    {GALA_SEATS_PER_TABLE} seats and keeps your group seated together —{" "}
                    <button type="button" className="text-primary underline" onClick={() => setMode("table")}>
                      book a table instead
                    </button>
                    .
                  </p>
                )}
              </>
            ) : (
              <>
                <AttendeeCountStepper id="tables" label="Number of Tables" value={tables} onChange={setTables} />
                <p className="text-xs text-muted-foreground">
                  Each table seats {GALA_SEATS_PER_TABLE}. You&apos;ll receive {GALA_SEATS_PER_TABLE} tickets per
                  table — send us your guests&apos; names any time before the event and we&apos;ll put them on the
                  tickets.
                </p>
              </>
            )}

            {overTableLimit && (
              <p className="text-destructive text-xs">
                For more than {MAX_TABLES} tables, please contact {GALA_DETAILS.enquiriesEmail} directly.
              </p>
            )}
            {overRemaining && !soldOut && (
              <p className="text-destructive text-xs">
                Only {seatsRemaining} seat{seatsRemaining === 1 ? "" : "s"} remain. Please reduce your booking.
              </p>
            )}

            <div className="space-y-1 pt-3 border-t border-border text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>
                  ${category.fee.toLocaleString()} FJD × {mode === "seat" ? seats : tables}{" "}
                  {mode === "seat" ? (seats === 1 ? "seat" : "seats") : tables === 1 ? "table" : "tables"}
                </span>
                <span>${totalFee.toLocaleString()} FJD</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total seats</span>
                <span>{totalSeats}</span>
              </div>
              <div className="flex justify-between font-semibold pt-1 border-t border-border">
                <span className="text-foreground">Total</span>
                <span className="text-primary text-lg">${totalFee.toLocaleString()} FJD</span>
              </div>
            </div>
          </div>

          {/* Buyer details */}
          <FieldGroup className="grid gap-6 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="firstName">First Name</FieldLabel>
              <Input id="firstName" placeholder="Enter your first name" value={formData.firstName}
                onChange={(e) => updateFormData("firstName", e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
              <Input id="lastName" placeholder="Enter your last name" value={formData.lastName}
                onChange={(e) => updateFormData("lastName", e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email Address</FieldLabel>
              <Input id="email" type="email" placeholder="email@example.com" value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
              <Input id="phone" type="tel" placeholder="+679 XXX XXXX" value={formData.phone}
                onChange={(e) => updateFormData("phone", e.target.value)} />
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="church">Church or Organisation (Optional)</FieldLabel>
              <Input id="church" placeholder="Enter your church or organisation" value={formData.church}
                onChange={(e) => updateFormData("church", e.target.value)} />
            </Field>
          </FieldGroup>

          <div className="flex justify-end pt-2">
            <Button className="w-full sm:w-auto" onClick={() => setStep(2)} disabled={!isStep1Valid}>
              Continue to Payment
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: payment ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-foreground">Payment</h2>
            <p className="text-muted-foreground mt-1">Choose how you&apos;d like to pay</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                {
                  id: "bank-transfer" as const,
                  icon: Landmark,
                  title: "Internet Banking",
                  blurb: "Transfer to the AGFJ Westpac account. Details are shown as soon as you submit.",
                },
                {
                  id: "mpaisa" as const,
                  icon: Smartphone,
                  title: "M-PAiSA",
                  blurb: `Send your payment to ${GALA_DETAILS.mpaisaNumber}.`,
                },
              ]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPaymentMethod(opt.id)}
                className={cn(
                  "text-left p-5 rounded-xl border-2 transition-all",
                  paymentMethod === opt.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-secondary/30 hover:border-primary/40"
                )}
              >
                <opt.icon
                  className={cn("h-5 w-5 mb-2", paymentMethod === opt.id ? "text-primary" : "text-muted-foreground")}
                />
                <div className="font-semibold text-foreground">{opt.title}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.blurb}</div>
              </button>
            ))}
          </div>

          {paymentMethod === "mpaisa" && (
            <div className="p-5 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
              <p className="text-sm font-semibold text-foreground">Pay by M-PAiSA</p>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-muted-foreground">Send to</span>
                <span className="font-mono text-base font-bold text-foreground">{GALA_DETAILS.mpaisaNumber}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="font-bold text-foreground">${totalFee.toLocaleString()} FJD</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Quote the booking reference shown on the next screen so HQ Finance can match your payment.
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Your tickets are emailed once HQ Finance confirms the payment.
          </p>

          <div className="p-4 rounded-lg bg-secondary space-y-2 text-sm">
            <h3 className="font-medium text-foreground">Booking Summary</h3>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="text-foreground">{formData.firstName} {formData.lastName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Booking</span>
              <span className="text-foreground">
                {mode === "seat"
                  ? `${seats} seat${seats === 1 ? "" : "s"} × $300 FJD`
                  : `${tables} table${tables === 1 ? "" : "s"} of ${GALA_SEATS_PER_TABLE} × $3,000 FJD`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total seats</span>
              <span className="text-foreground">{totalSeats}</span>
            </div>
            <div className="flex justify-between border-t border-border/50 pt-2 font-semibold">
              <span>Total Due</span>
              <span className="text-primary">${totalFee.toLocaleString()} FJD</span>
            </div>
          </div>

          <div className="flex justify-center">
            <TurnstileWidget onVerify={setTurnstileToken} />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={!turnstileToken || isProcessing}>
              {isProcessing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
              ) : (
                "Complete Booking"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
