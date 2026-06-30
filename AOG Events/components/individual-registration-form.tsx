"use client";

import { useState } from "react";
import { CategoryInfo } from "@/lib/types";
import { VenueSelector } from "./venue-selector";
import { PaymentTypeSelector } from "./payment-type-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { User, CreditCard, Minus, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadAnzScript, initAnzPayment } from "@/lib/anz-egate-client";

interface Venue {
  id: string;
  name: string;
  city?: string | null;
  capacity: number;
  currentRegistrations: number;
}

interface IndividualRegistrationFormProps {
  category: CategoryInfo;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: (data: unknown) => void;
  eventId?: string;
  venues?: Venue[];
  stepperMax?: number;
}

export function IndividualRegistrationForm({
  category,
  onBack,
  onCancel,
  onSubmit,
  eventId,
  venues = [],
  stepperMax,
}: IndividualRegistrationFormProps) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxTickets = stepperMax !== undefined
    ? Math.min(category.maxTicketsPerReg, stepperMax)
    : category.maxTicketsPerReg;

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    church: "",
    venue: "",
    paymentMethod: "" as "online" | "bank-transfer" | "",
  });
  const [numberOfTickets, setNumberOfTickets] = useState(1);
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [installmentCount, setInstallmentCount] = useState(5);

  const updateFormData = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const changeTickets = (delta: number) =>
    setNumberOfTickets((n) => Math.max(1, Math.min(maxTickets, n + delta)));

  const totalFee = category.fee * numberOfTickets;

  const isStep1Valid = formData.firstName && formData.lastName && formData.email && formData.phone;
  const isStep2Valid = formData.venue !== "";

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
          paymentType: formData.paymentMethod === "online" ? "full" : paymentType,
          installmentCount: formData.paymentMethod !== "online" && paymentType === "partial" ? installmentCount : null,
          eventId,
          ...formData,
        }),
      });

      const dbData = await dbResponse.json();
      if (!dbResponse.ok) throw new Error(dbData.error || "Could not save registration");
      const registrationId = dbData.registrationId;

      if (formData.paymentMethod === "online" && totalFee > 0) {
        await loadAnzScript();
        const payRes = await fetch("/api/payment/anz/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: registrationId, amount: totalFee, customerEmail: formData.email }),
        });
        const payData = await payRes.json();
        if (payData.sessionId) {
          initAnzPayment(
            payData.sessionId,
            payData.merchantId,
            () => onSubmit({ category: category.id, registrationId, ...formData, numberOfTickets, fee: totalFee, paymentStatus: "completed" }),
            () => { setIsProcessing(false); alert("Payment was cancelled"); },
            (err: any) => { setIsProcessing(false); console.error(err); alert("An error occurred during payment"); }
          );
        } else {
          throw new Error(payData.error || "Failed to create payment session");
        }
      } else {
        onSubmit({
          category: category.id,
          registrationId,
          ...formData,
          numberOfTickets,
          fee: totalFee,
          paymentType: formData.paymentMethod === "online" ? "full" : paymentType,
          installmentCount: formData.paymentMethod !== "online" && paymentType === "partial" ? installmentCount : null,
        });
      }
    } catch (err: any) {
      setIsProcessing(false);
      setError(err.message);
    }
  };

  const steps = [
    { number: 1, title: "Your Details", icon: User },
    { number: 2, title: "Venue & Payment", icon: CreditCard },
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

            <Field className="md:col-span-2">
              <FieldLabel htmlFor="church">Church Affiliation (Optional)</FieldLabel>
              <Input id="church" placeholder="Enter your church name if applicable" value={formData.church}
                onChange={(e) => updateFormData("church", e.target.value)} />
            </Field>
          </FieldGroup>

          {/* Ticket Quantity */}
          <div className="p-5 rounded-xl border-2 border-border bg-secondary/30 space-y-3">
            <div>
              <FieldLabel>Number of Tickets</FieldLabel>
              <p className="text-xs text-muted-foreground mt-0.5">
                Including yourself — register friends & family (max {maxTickets})
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="icon" onClick={() => changeTickets(-1)}
                  disabled={numberOfTickets <= 1} className="h-10 w-10 rounded-full">
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="text-center min-w-[60px]">
                  <div className="text-3xl font-bold text-foreground">{numberOfTickets}</div>
                  <div className="text-xs text-muted-foreground">ticket{numberOfTickets > 1 ? "s" : ""}</div>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => changeTickets(1)}
                  disabled={numberOfTickets >= maxTickets} className="h-10 w-10 rounded-full">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Live fee calculation */}
            <div className="space-y-1 pt-2 border-t border-border text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>${category.fee} FJD × {numberOfTickets} ticket{numberOfTickets > 1 ? "s" : ""}</span>
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
            <Button onClick={() => setStep(2)} disabled={!isStep1Valid}>Continue to Venue</Button>
          </div>
        </div>
      )}

      {/* Step 2: Venue & Payment */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-foreground">Venue & Payment</h2>
            <p className="text-muted-foreground mt-1">Select your venue and payment method</p>
          </div>

          <VenueSelector selectedVenue={formData.venue}
            onSelect={(venueId) => updateFormData("venue", venueId)} venues={venues} />

          <div className="space-y-3">
            <FieldLabel>Payment Method</FieldLabel>
            <div className="grid gap-3 md:grid-cols-2">
              {(["online", "bank-transfer"] as const).map((method) => (
                <button key={method} onClick={() => updateFormData("paymentMethod", method)}
                  className={cn("p-4 rounded-lg border text-left transition-all",
                    formData.paymentMethod === method
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50"
                  )}>
                  <div className="font-medium text-foreground">
                    {method === "online" ? "Online Payment" : "Bank Transfer"}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {method === "online" ? "Pay via VaizeePay (M-PAiSA, MyCash, Visa/Mastercard)" : "Direct bank-to-bank transfer"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {formData.paymentMethod === "bank-transfer" && (
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
              <span>{formData.firstName} {formData.lastName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tickets</span>
              <span>{numberOfTickets} × ${category.fee} FJD</span>
            </div>
            <div className="flex justify-between border-t border-border/50 pt-2 font-semibold">
              <span>Total Fee</span>
              <span className="text-primary">${totalFee.toLocaleString()} FJD</span>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            </div>
            <Button onClick={handleSubmit} disabled={!isStep2Valid || !formData.paymentMethod || isProcessing}>
              {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : "Complete Registration"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
