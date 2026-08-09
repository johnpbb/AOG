"use client";

import { useState } from "react";
import { CategoryInfo, YOUTH_AGE_RANGE, KIDS_AGE_RANGE } from "@/lib/types";
import { PaymentTypeSelector } from "./payment-type-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AttendeeCountStepper } from "@/components/attendee-count-stepper";
import { User, CreditCard, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { COUNTRIES } from "@/lib/countries";

interface IndividualRegistrationFormProps {
  category: CategoryInfo;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: (data: unknown) => void;
  eventId?: string;
}

export function IndividualRegistrationForm({
  category,
  onBack,
  onCancel,
  onSubmit,
  eventId,
}: IndividualRegistrationFormProps) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOverseasDelegate = category.id === "overseas-delegates";

  // Online payment (ANZ eGate) is disabled for now — no merchant account yet.
  // Overseas delegates pay via World Remit to M-PAiSA; locals pay via M-PAiSA directly.
  const paymentMethods = isOverseasDelegate
    ? ([
        { id: "bank-transfer", label: "Bank Transfer", description: "Direct bank-to-bank transfer" },
        { id: "world-remit", label: "World Remit to M-PAiSA", description: "World Remit transfer to our M-PAiSA account" },
      ] as const)
    : ([
        { id: "bank-transfer", label: "Bank Transfer", description: "Direct bank-to-bank transfer" },
        { id: "mpaisa", label: "M-PAiSA", description: "Mobile money transfer to our M-PAiSA number" },
      ] as const);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    church: "",
    country: "",
    paymentMethod: "" as "bank-transfer" | "mpaisa" | "world-remit" | "",
  });
  const [adults, setAdults] = useState(1);
  const [youth, setYouth] = useState(0);
  const [kids, setKids] = useState(0);
  const numberOfTickets = adults + youth + kids;
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [installmentCount, setInstallmentCount] = useState(5);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const updateFormData = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const totalFee = category.fee * numberOfTickets;

  const overAttendeeLimit = category.pool
    ? adults > category.pool.adults || youth > category.pool.youth || kids > category.pool.kids
    : false;

  const isStep1Valid =
    formData.firstName && formData.lastName && formData.email && formData.phone && numberOfTickets > 0 &&
    (!isOverseasDelegate || formData.country);

  const handleSubmit = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const dbResponse = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category.id,
          type: "individual",
          fee: totalFee,
          numberOfTickets,
          adults,
          youth,
          kids,
          paymentType,
          installmentCount: paymentType === "partial" ? installmentCount : null,
          eventId,
          turnstileToken,
          ...formData,
        }),
      });

      const dbData = await dbResponse.json();
      if (!dbResponse.ok) throw new Error(dbData.error || "Could not save registration");
      const registrationId = dbData.registrationId;

      onSubmit({
        category: category.id,
        registrationId,
        ...formData,
        numberOfTickets,
        fee: totalFee,
        paymentType,
        installmentCount: paymentType === "partial" ? installmentCount : null,
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
      {/* Progress */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, index) => (
          <div key={s.number} className="flex items-center">
            <button
              onClick={() => setStep(s.number)}
              disabled={s.number === 2 && !isStep1Valid}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                step === s.number ? "bg-primary text-primary-foreground"
                  : step > s.number ? "bg-green-100 text-green-700"
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

      {/* Error banner */}
      {error && (
        <div role="alert" className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Personal Details + Ticket Quantity */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-foreground">Your Details</h2>
            <p className="text-muted-foreground mt-1">Enter your information for {category.name}</p>
          </div>

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

            <Field className={isOverseasDelegate ? "" : "md:col-span-2"}>
              <FieldLabel htmlFor="church">Church Affiliation (Optional)</FieldLabel>
              <Input id="church" placeholder="Enter your church name if applicable" value={formData.church}
                onChange={(e) => updateFormData("church", e.target.value)} />
            </Field>

            {isOverseasDelegate && (
              <Field>
                <FieldLabel htmlFor="country">Country</FieldLabel>
                <Select value={formData.country} onValueChange={(v) => updateFormData("country", v)}>
                  <SelectTrigger id="country" className="w-full">
                    <SelectValue placeholder="Select your country of residence" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </FieldGroup>

          {/* Attendee counts */}
          <div className="p-5 rounded-xl border-2 border-border bg-secondary/30 space-y-3">
            <div>
              <FieldLabel>Attendees</FieldLabel>
              <p className="text-xs text-muted-foreground mt-0.5">
                Including yourself — register friends & family, by age group
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <AttendeeCountStepper id="adults" label="Adults" value={adults} onChange={setAdults} />
              <AttendeeCountStepper id="youth" label={`NextGen / Youth (${YOUTH_AGE_RANGE})`} value={youth} onChange={setYouth} />
              <AttendeeCountStepper id="kids" label={`Kids (${KIDS_AGE_RANGE})`} value={kids} onChange={setKids} />
            </div>
            <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
              <span className="text-muted-foreground">Total Attendees</span>
              <span className={cn("font-semibold", overAttendeeLimit ? "text-destructive" : "text-foreground")}>
                {numberOfTickets.toLocaleString()}
              </span>
            </div>
            {overAttendeeLimit && (
              <p className="text-destructive text-xs">
                This exceeds the remaining spots for {category.name}. Please reduce your numbers or try again later.
              </p>
            )}
            {/* Live fee calculation */}
            <div className="space-y-1 pt-2 border-t border-border text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>${category.fee} FJD × {numberOfTickets} ticket{numberOfTickets !== 1 ? "s" : ""}</span>
                <span>${totalFee.toLocaleString()} FJD</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-primary text-lg">${totalFee.toLocaleString()} FJD</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onBack}>Back</Button>
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            </div>
            <Button onClick={() => setStep(2)} disabled={!isStep1Valid || overAttendeeLimit}>Continue to Payment</Button>
          </div>
        </div>
      )}

      {/* Step 2: Payment */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-foreground">Payment</h2>
            <p className="text-muted-foreground mt-1">Select your payment method</p>
          </div>

          <div className="space-y-3">
            <FieldLabel>Payment Method</FieldLabel>
            <div className="grid gap-3 md:grid-cols-2">
              {paymentMethods.map((method) => (
                <button key={method.id} onClick={() => updateFormData("paymentMethod", method.id)}
                  className={cn("p-4 rounded-lg border text-left transition-all",
                    formData.paymentMethod === method.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50"
                  )}>
                  <div className="font-medium text-foreground">{method.label}</div>
                  <div className="text-sm text-muted-foreground mt-1">{method.description}</div>
                </button>
              ))}
            </div>
            {!formData.paymentMethod && (
              <p className="text-xs text-muted-foreground">Select a payment method above to continue.</p>
            )}
          </div>

          {formData.paymentMethod && (
            <PaymentTypeSelector
              paymentType={paymentType}
              onPaymentTypeChange={setPaymentType}
              installmentCount={installmentCount}
              onInstallmentCountChange={setInstallmentCount}
              totalFee={totalFee}
            />
          )}

          {/* Summary */}
          <div className="p-4 rounded-lg bg-secondary space-y-2 text-sm">
            <h3 className="font-medium text-foreground">Registration Summary</h3>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="text-foreground">{formData.firstName} {formData.lastName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tickets</span>
              <span className="text-foreground">{numberOfTickets} × ${category.fee} FJD</span>
            </div>
            <div className="flex justify-between border-t border-border/50 pt-2 font-semibold">
              <span>Total Fee</span>
              <span className="text-primary">${totalFee.toLocaleString()} FJD</span>
            </div>
          </div>

          <div className="flex justify-center">
            <TurnstileWidget onVerify={setTurnstileToken} />
          </div>

          <div className="flex justify-between pt-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            </div>
            <Button onClick={handleSubmit} disabled={!formData.paymentMethod || !turnstileToken || isProcessing}>
              {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : "Complete Registration"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
