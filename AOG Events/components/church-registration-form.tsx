"use client";

import { useState } from "react";
import { CategoryInfo, YOUTH_AGE_RANGE, KIDS_AGE_RANGE } from "@/lib/types";
import { ChurchOption } from "./church-autocomplete";
import { PaymentTypeSelector } from "./payment-type-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Building, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { AttendeeCountStepper } from "@/components/attendee-count-stepper";

interface ChurchRegistrationFormProps {
  category: CategoryInfo;
  church: ChurchOption | null; // pre-selected from the church-lookup step; null for WFC-without-a-real-match
  onBack: () => void;
  onCancel: () => void;
  onSubmit: (data: unknown) => void;
  eventId?: string;
  stepperMax?: number;
}

export function ChurchRegistrationForm({
  category,
  church,
  onBack,
  onCancel,
  onSubmit,
  eventId,
  stepperMax,
}: ChurchRegistrationFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxTickets = stepperMax !== undefined
    ? Math.min(category.maxTicketsPerReg, stepperMax)
    : category.maxTicketsPerReg;

  const [formData, setFormData] = useState({
    registrarName: "",
    pastorName: "",
    contactPreference: "church" as "church" | "personal" | "both",
    churchPhone: "",
    churchEmail: "",
    personalPhone: "",
    personalEmail: "",
  });
  const [adults, setAdults] = useState(0);
  const [youth, setYouth] = useState(0);
  const [kids, setKids] = useState(0);
  const total = adults + youth + kids;
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [installmentCount, setInstallmentCount] = useState(5);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const updateFormData = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const contactPhone = formData.contactPreference === "church" ? formData.churchPhone : formData.personalPhone;
  const contactEmail = formData.contactPreference === "church" ? formData.churchEmail : formData.personalEmail;
  const needsChurchDetails = formData.contactPreference === "church" || formData.contactPreference === "both";
  const needsPersonalDetails = formData.contactPreference === "personal" || formData.contactPreference === "both";

  const isFormValid =
    !!church &&
    formData.registrarName &&
    formData.pastorName &&
    (!needsChurchDetails || (formData.churchPhone && formData.churchEmail)) &&
    (!needsPersonalDetails || (formData.personalPhone && formData.personalEmail)) &&
    total > 0;

  const overAttendeeLimit = total > maxTickets;

  const handleSubmit = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const dbResponse = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category.id,
          type: "church",
          churchId: church?.id ?? null,
          churchName: church?.name ?? "",
          registrarName: formData.registrarName,
          pastorName: formData.pastorName,
          contactPreference: formData.contactPreference,
          contactPhone,
          contactEmail,
          email: contactEmail,
          phone: contactPhone,
          fee: category.fee,
          adults,
          youth,
          kids,
          numberOfTickets: total,
          paymentMethod: "bank-transfer",
          paymentType,
          installmentCount: paymentType === "partial" ? installmentCount : null,
          eventId,
          turnstileToken,
        }),
      });

      const dbData = await dbResponse.json();
      if (!dbResponse.ok) {
        throw new Error(dbData.error || "Could not save registration");
      }

      onSubmit({
        category: category.id,
        registrationId: dbData.registrationId,
        ...formData,
        churchName: church?.name,
        numberOfTickets: total,
        fee: category.fee,
        paymentMethod: "bank-transfer",
        paymentType,
        installmentCount: paymentType === "partial" ? installmentCount : null,
      });
    } catch (err: any) {
      setIsProcessing(false);
      setError(err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Error banner */}
      {error && (
        <div role="alert" className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-foreground">Church Details</h2>
          <p className="text-muted-foreground mt-1">Enter your church information for {category.name}</p>
        </div>

          <Field>
            <FieldLabel>Church</FieldLabel>
            {church ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-secondary/40 text-sm">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{church.name}</span>
                {church.district && <span className="text-muted-foreground">— {church.district}</span>}
              </div>
            ) : (
              <p className="text-xs text-destructive mt-1">
                No church selected. Please go back and select your church before continuing.
              </p>
            )}
          </Field>

          <FieldGroup className="grid gap-6 md:grid-cols-2 text-xs text-muted-foreground mt-0.5">
            <Field>
              <FieldLabel htmlFor="registrarName">Registrar Name</FieldLabel>
              <p className="text-xs text-muted-foreground mb-1">The person filling out this form.</p>
              <Input id="registrarName" placeholder="Full name" value={formData.registrarName}
                onChange={(e) => updateFormData("registrarName", e.target.value)} />
            </Field>

            <Field>
              <FieldLabel htmlFor="pastorName">Pastor / Leader Name</FieldLabel>
              <Input id="pastorName" placeholder="Full name" value={formData.pastorName}
                onChange={(e) => updateFormData("pastorName", e.target.value)} />
            </Field>
          </FieldGroup>

          {/* Contact preference toggle */}
          <div className="space-y-3">
            <FieldLabel>Contact Details</FieldLabel>
            <p className="text-xs text-muted-foreground -mt-2">
              Choose whether the confirmation email and QR code should go to the church&apos;s
              general contact, or to you personally.
            </p>
            <RadioGroup
              value={formData.contactPreference}
              onValueChange={(value) => updateFormData("contactPreference", value)}
              className="grid gap-3 md:grid-cols-3"
            >
              {(["church", "personal", "both"] as const).map((pref) => (
                <label key={pref} htmlFor={`contactPreference-${pref}`}
                  className={cn("flex items-center gap-2 p-3 rounded-lg border text-sm cursor-pointer transition-all",
                    formData.contactPreference === pref
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50"
                  )}>
                  <RadioGroupItem id={`contactPreference-${pref}`} value={pref} />
                  {pref === "church" ? "Use church contact details" : pref === "personal" ? "Use my personal contact details" : "Both"}
                </label>
              ))}
            </RadioGroup>

            {needsChurchDetails && (
              <FieldGroup className="grid gap-6 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="churchPhone">{needsPersonalDetails ? "Church Phone Number" : "Phone Number"}</FieldLabel>
                  <Input id="churchPhone" type="tel" placeholder="+679 XXX XXXX"
                    value={formData.churchPhone}
                    onChange={(e) => updateFormData("churchPhone", e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="churchEmail">{needsPersonalDetails ? "Church Email Address" : "Email Address"}</FieldLabel>
                  <Input id="churchEmail" type="email" placeholder="email@example.com"
                    value={formData.churchEmail}
                    onChange={(e) => updateFormData("churchEmail", e.target.value)} />
                </Field>
              </FieldGroup>
            )}
            {needsPersonalDetails && (
              <FieldGroup className="grid gap-6 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="personalPhone">{needsChurchDetails ? "Personal Phone Number" : "Phone Number"}</FieldLabel>
                  <Input id="personalPhone" type="tel" placeholder="+679 XXX XXXX"
                    value={formData.personalPhone}
                    onChange={(e) => updateFormData("personalPhone", e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="personalEmail">{needsChurchDetails ? "Personal Email Address" : "Email Address"}</FieldLabel>
                  <Input id="personalEmail" type="email" placeholder="email@example.com"
                    value={formData.personalEmail}
                    onChange={(e) => updateFormData("personalEmail", e.target.value)} />
                </Field>
              </FieldGroup>
            )}
          </div>

          {/* Attendance Demographics */}
          <div className="text-xs text-muted-foreground mt-0.5 p-5 rounded-xl border-2 border-border bg-secondary/30 space-y-3">
            <div>
              <FieldLabel>Attendance Demographics</FieldLabel>
              <p className="text-xs text-muted-foreground mt-0.5">
                How many attendees from your church, by age group? (max {maxTickets.toLocaleString()} total)
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <AttendeeCountStepper id="adults" label="Adults" value={adults} onChange={setAdults} />
              <AttendeeCountStepper
                id="youth"
                label={`NextGen / Youth (${YOUTH_AGE_RANGE})`}
                value={youth}
                onChange={setYouth}
              />
              <AttendeeCountStepper id="kids" label={`Kids (${KIDS_AGE_RANGE})`} value={kids} onChange={setKids} />
            </div>
            <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
              <span className="text-muted-foreground">Total Attendees</span>
              <span className={cn("font-semibold", overAttendeeLimit ? "text-destructive" : "text-foreground")}>
                {total.toLocaleString()}
              </span>
            </div>
            {overAttendeeLimit && (
              <p className="text-destructive text-xs">
                This exceeds the {maxTickets.toLocaleString()} attendee limit for {category.name}. Please reduce your numbers or choose a different category.
              </p>
            )}
            <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
              <span className="text-muted-foreground">Registration fee</span>
              <span className="font-semibold text-primary">
                ${category.fee.toLocaleString()} FJD <span className="text-muted-foreground font-normal">(flat rate)</span>
              </span>
            </div>
          </div>

          <PaymentTypeSelector
            paymentType={paymentType}
            onPaymentTypeChange={setPaymentType}
            installmentCount={installmentCount}
            onInstallmentCountChange={setInstallmentCount}
            totalFee={category.fee}
          />

          {/* Payment notice */}
          <div className="p-4 rounded-lg border border-brand-orange/30 bg-brand-orange/5 text-sm space-y-1">
            <p className="font-semibold text-foreground">Payment via Bank Transfer</p>
            <p className="text-muted-foreground">
              After submitting, you'll receive bank transfer details. Your tickets will be issued once our team verifies your remittance — usually within 1–2 business days.
            </p>
          </div>

          {/* Summary */}
          <div className="p-4 rounded-lg bg-secondary space-y-2 text-sm">
            <h3 className="font-medium text-foreground">Registration Summary</h3>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Category</span>
              <span className="text-foreground">{category.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Church</span>
              <span className="text-foreground">{church?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Attendees</span>
              <span className="text-foreground">{adults} adults, {youth} youth, {kids} kids ({total} total)</span>
            </div>
            <div className="flex justify-between border-t border-border/50 pt-2 font-semibold">
              <span>Total Fee</span>
              <span className="text-primary">${category.fee.toLocaleString()} FJD</span>
            </div>
          </div>

          <div className="flex justify-center">
            <TurnstileWidget onVerify={setTurnstileToken} />
          </div>

          <div className="flex justify-between pt-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onBack}>Back</Button>
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            </div>
            <Button onClick={handleSubmit} disabled={!isFormValid || overAttendeeLimit || !turnstileToken || isProcessing}>
              {isProcessing
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
                : "Submit Registration"}
            </Button>
          </div>
        </div>
    </div>
  );
}
