"use client";

import { useState } from "react";
import { CategoryInfo, DISTRICTS } from "@/lib/types";
import { VenueSelector } from "./venue-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Building, CreditCard, Loader2, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadAnzScript, initAnzPayment } from "@/lib/anz-egate-client";

interface Venue {
  id: string;
  name: string;
  city?: string | null;
  capacity: number;
  currentRegistrations: number;
}

interface ChurchRegistrationFormProps {
  category: CategoryInfo;
  onBack: () => void;
  onSubmit: (data: unknown) => void;
  eventId?: string;
  venues?: Venue[];
  // Live availability from /api/categories/availability
  stepperMax?: number; // remaining pool — dynamic upper bound
}

export function ChurchRegistrationForm({
  category,
  onBack,
  onSubmit,
  eventId,
  venues = [],
  stepperMax,
}: ChurchRegistrationFormProps) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxTickets = stepperMax !== undefined
    ? Math.min(category.maxTicketsPerReg, stepperMax)
    : category.maxTicketsPerReg;

  const [formData, setFormData] = useState({
    churchName: "",
    district: "",
    pastorName: "",
    pastorEmail: "",
    pastorPhone: "",
    venue: "",
    paymentMethod: "" as "online" | "bank-transfer" | "",
  });
  const [numberOfTickets, setNumberOfTickets] = useState(1);

  const updateFormData = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const changeTickets = (delta: number) =>
    setNumberOfTickets((n) => Math.max(1, Math.min(maxTickets, n + delta)));

  const isStep1Valid =
    formData.churchName &&
    formData.district &&
    formData.pastorName &&
    formData.pastorEmail &&
    formData.pastorPhone;

  const isStep2Valid = formData.venue !== "";

  const handleSubmit = async () => {
    setIsProcessing(true);
    setError(null);
    const registrationId = `AOG100-${Date.now().toString(36).toUpperCase()}`;

    try {
      const dbResponse = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId,
          category: category.id,
          type: "church",
          email: formData.pastorEmail,
          phone: formData.pastorPhone,
          fee: category.fee,
          numberOfTickets,
          eventId,
          ...formData,
        }),
      });

      const dbData = await dbResponse.json();
      if (!dbResponse.ok) {
        throw new Error(dbData.error || "Could not save registration");
      }

      if (formData.paymentMethod === "online" && category.fee > 0) {
        await loadAnzScript();
        const payRes = await fetch("/api/payment/anz/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: registrationId,
            amount: category.fee,
            customerEmail: formData.pastorEmail,
          }),
        });
        const payData = await payRes.json();
        if (payData.sessionId) {
          initAnzPayment(
            payData.sessionId,
            payData.merchantId,
            () => onSubmit({ category: category.id, registrationId, ...formData, numberOfTickets, paymentStatus: "completed" }),
            () => { setIsProcessing(false); alert("Payment was cancelled"); },
            (err: any) => { setIsProcessing(false); console.error(err); alert("An error occurred during payment"); }
          );
        } else {
          throw new Error(payData.error || "Failed to create payment session");
        }
      } else {
        onSubmit({ category: category.id, registrationId, ...formData, numberOfTickets });
      }
    } catch (err: any) {
      setIsProcessing(false);
      setError(err.message);
    }
  };

  const steps = [
    { number: 1, title: "Church Details", icon: Building },
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
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Church Details + Ticket Quantity */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-foreground">Church Details</h2>
            <p className="text-muted-foreground mt-1">Enter your church information for {category.name}</p>
          </div>

          <FieldGroup className="grid gap-6 md:grid-cols-2">
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="churchName">Church Name</FieldLabel>
              <Input id="churchName" placeholder="Enter your church name" value={formData.churchName}
                onChange={(e) => updateFormData("churchName", e.target.value)} />
            </Field>

            <Field>
              <FieldLabel htmlFor="district">District</FieldLabel>
              <Select value={formData.district} onValueChange={(v) => updateFormData("district", v)}>
                <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                <SelectContent>
                  {DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="pastorName">Pastor / Leader Name</FieldLabel>
              <Input id="pastorName" placeholder="Full name" value={formData.pastorName}
                onChange={(e) => updateFormData("pastorName", e.target.value)} />
            </Field>

            <Field>
              <FieldLabel htmlFor="pastorEmail">Email Address</FieldLabel>
              <Input id="pastorEmail" type="email" placeholder="email@example.com" value={formData.pastorEmail}
                onChange={(e) => updateFormData("pastorEmail", e.target.value)} />
            </Field>

            <Field>
              <FieldLabel htmlFor="pastorPhone">Phone Number</FieldLabel>
              <Input id="pastorPhone" type="tel" placeholder="+679 XXX XXXX" value={formData.pastorPhone}
                onChange={(e) => updateFormData("pastorPhone", e.target.value)} />
            </Field>
          </FieldGroup>

          {/* Ticket Quantity */}
          <div className="p-5 rounded-xl border-2 border-border bg-secondary/30 space-y-3">
            <div>
              <FieldLabel>Number of Tickets</FieldLabel>
              <p className="text-xs text-muted-foreground mt-0.5">
                How many attendees from your church? (max {maxTickets.toLocaleString()} available)
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="icon" onClick={() => changeTickets(-1)}
                  disabled={numberOfTickets <= 1} className="h-10 w-10 rounded-full">
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="text-center min-w-[80px]">
                  <div className="text-3xl font-bold text-foreground">{numberOfTickets.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">tickets</div>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => changeTickets(1)}
                  disabled={numberOfTickets >= maxTickets} className="h-10 w-10 rounded-full">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Input
                type="number"
                min={1}
                max={maxTickets}
                value={numberOfTickets}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) setNumberOfTickets(Math.max(1, Math.min(maxTickets, v)));
                }}
                className="w-28 text-center font-mono"
              />
            </div>
            <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
              <span className="text-muted-foreground">Registration fee</span>
              <span className="font-semibold text-primary">
                ${category.fee.toLocaleString()} FJD <span className="text-muted-foreground font-normal">(flat rate)</span>
              </span>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={onBack}>Back</Button>
            <Button onClick={() => setStep(2)} disabled={!isStep1Valid}>
              Continue to Venue
            </Button>
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
                  <div className="font-medium">{method === "online" ? "Online Payment" : "Bank Transfer"}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {method === "online" ? "Pay via VaizeePay (M-PAiSA, MyCash, Visa/Mastercard)" : "For large transactions via bank-to-bank transfer"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 rounded-lg bg-secondary space-y-2 text-sm">
            <h3 className="font-medium text-foreground">Registration Summary</h3>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Category</span>
              <span>{category.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Church</span>
              <span>{formData.churchName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tickets</span>
              <span>{numberOfTickets.toLocaleString()} seats</span>
            </div>
            <div className="flex justify-between border-t border-border/50 pt-2 font-semibold">
              <span>Total Fee</span>
              <span className="text-primary">${category.fee.toLocaleString()} FJD</span>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={handleSubmit} disabled={!isStep2Valid || !formData.paymentMethod || isProcessing}>
              {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : "Complete Registration"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
