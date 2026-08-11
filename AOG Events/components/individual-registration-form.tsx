"use client";

import { useEffect, useState } from "react";
import { CategoryInfo, YOUTH_AGE_RANGE, KIDS_YOUNGER_AGE_RANGE, KIDS_OLDER_AGE_RANGE } from "@/lib/types";
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

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    church: "",
    country: "",
    // Westpac Internet Bank Transfer is the only payment method — no merchant
    // account for card/online payment, and no other manual method for now.
    paymentMethod: "bank-transfer" as const,
  });
  const [adults, setAdults] = useState(1);
  const [youth, setYouth] = useState(0);
  const [kidsYounger, setKidsYounger] = useState(0);
  const [kidsOlder, setKidsOlder] = useState(0);
  const kids = kidsYounger + kidsOlder;
  const numberOfTickets = adults + youth + kids;

  // One required name row per Adult+Youth ticket (kids stay headcount-only —
  // no ticket, no name). Index 0..adults-1 are Adult rows, the rest Youth.
  const [attendeeNames, setAttendeeNames] = useState<{ firstName: string; lastName: string; email: string; phone: string }[]>([]);
  useEffect(() => {
    const size = adults + youth;
    setAttendeeNames((prev) =>
      Array.from({ length: size }, (_, i) => prev[i] ?? { firstName: "", lastName: "", email: "", phone: "" })
    );
  }, [adults, youth]);
  const updateAttendeeName = (index: number, field: "firstName" | "lastName" | "email" | "phone", value: string) =>
    setAttendeeNames((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  const attendeeNamesValid = attendeeNames.length > 0 && attendeeNames.every((a) => a.firstName.trim() && a.lastName.trim());
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
    (!isOverseasDelegate || formData.country) && attendeeNamesValid;

  const handleSubmit = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const attendees = attendeeNames.map((a, i) => ({
        firstName: a.firstName,
        lastName: a.lastName,
        ageCategory: (i < adults ? "ADULT" : "YOUTH") as "ADULT" | "YOUTH",
        email: a.email || undefined,
        phone: a.phone || undefined,
      }));

      const dbResponse = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category.id,
          type: "individual",
          fee: totalFee,
          numberOfTickets,
          attendees,
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
            <p className="text-muted-foreground mt-1">
              Enter your information for {category.id === "overseas-delegates" ? "Overseas Attendee" : category.name}
            </p>
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <AttendeeCountStepper id="adults" label="Adults" value={adults} onChange={setAdults} />
              <AttendeeCountStepper id="youth" label={`NextGen / Youth (${YOUTH_AGE_RANGE})`} value={youth} onChange={setYouth} />
              <AttendeeCountStepper id="kidsYounger" label={`Kids (${KIDS_YOUNGER_AGE_RANGE})`} value={kidsYounger} onChange={setKidsYounger} />
              <AttendeeCountStepper id="kidsOlder" label={`Kids (${KIDS_OLDER_AGE_RANGE})`} value={kidsOlder} onChange={setKidsOlder} />
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

          {/* Named attendees — one per Adult/Youth ticket */}
          {attendeeNames.length > 0 && (
            <div className="p-5 rounded-xl border-2 border-border bg-secondary/30 space-y-4">
              <div>
                <FieldLabel>Name Each Ticket</FieldLabel>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Every adult and youth ticket is printed with the attendee&apos;s own name.
                  {kids > 0 && " Kids are counted above but don't need to be named."}
                </p>
              </div>
              <div className="space-y-4">
                {attendeeNames.map((a, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        Attendee {i + 1} <span className="text-muted-foreground font-normal">({i < adults ? "Adult" : "Youth"})</span>
                      </span>
                      {i === 0 && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() =>
                            setAttendeeNames((prev) =>
                              prev.map((row, idx) =>
                                idx === 0 ? { ...row, firstName: formData.firstName, lastName: formData.lastName } : row
                              )
                            )
                          }
                        >
                          Use my details above
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input placeholder="First name" value={a.firstName}
                        onChange={(e) => updateAttendeeName(i, "firstName", e.target.value)} />
                      <Input placeholder="Last name" value={a.lastName}
                        onChange={(e) => updateAttendeeName(i, "lastName", e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onBack}>Back</Button>
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            </div>
            <Button className="w-full sm:w-auto" onClick={() => setStep(2)} disabled={!isStep1Valid || overAttendeeLimit}>Continue to Payment</Button>
          </div>
        </div>
      )}

      {/* Step 2: Payment */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-foreground">Payment</h2>
            <p className="text-muted-foreground mt-1">Payment via Westpac Internet Bank Transfer</p>
          </div>

          <div className="p-4 rounded-lg border border-border bg-secondary/30">
            <div className="font-medium text-foreground">Bank Transfer</div>
            <div className="text-sm text-muted-foreground mt-1">
              Pay via Westpac Internet Bank Transfer. Account details are provided after you submit this form.
            </div>
          </div>

          <PaymentTypeSelector
            paymentType={paymentType}
            onPaymentTypeChange={setPaymentType}
            installmentCount={installmentCount}
            onInstallmentCountChange={setInstallmentCount}
            totalFee={totalFee}
          />

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

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            </div>
            <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={!turnstileToken || isProcessing}>
              {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : "Complete Registration"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
