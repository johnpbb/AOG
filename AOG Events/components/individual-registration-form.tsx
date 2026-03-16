"use client";

import { useState } from "react";
import { CategoryInfo } from "@/lib/types";
import { VenueSelector } from "./venue-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { User, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadAnzScript, initAnzPayment } from "@/lib/anz-egate-client";
import { Loader2 } from "lucide-react";

interface IndividualRegistrationFormProps {
  category: CategoryInfo;
  onBack: () => void;
  onSubmit: (data: unknown) => void;
}

export function IndividualRegistrationForm({
  category,
  onBack,
  onSubmit,
}: IndividualRegistrationFormProps) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    church: "",
    venue: "",
    paymentMethod: "" as "online" | "bank-transfer" | "",
  });

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isStep1Valid =
    formData.firstName && formData.lastName && formData.email && formData.phone;

  const isStep2Valid = formData.venue !== "";

  const handleSubmit = async () => {
    setIsProcessing(true);
    const registrationId = `AOG100-${Date.now().toString(36).toUpperCase()}`;

    try {
      // 1. Save to database first
      const dbResponse = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId,
          category: category.id,
          type: "individual",
          fee: category.fee,
          ...formData,
        }),
      });

      if (!dbResponse.ok) throw new Error("Could not save registration");

      if (formData.paymentMethod === "online" && category.fee > 0) {
        // 2. ANZ Payment Flow
        await loadAnzScript();
        
        const response = await fetch("/api/payment/anz/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: registrationId,
            amount: category.fee,
            customerEmail: formData.email
          })
        });

        const data = await response.json();
        
        if (data.sessionId) {
          initAnzPayment(
            data.sessionId,
            data.merchantId,
            (resultIndicator, sessionVersion) => {
              // Success! - In a real app we'd redirect to verification here
              onSubmit({
                category: category.id,
                registrationId,
                ...formData,
                paymentStatus: "completed"
              });
            },
            () => {
              setIsProcessing(false);
              alert("Payment was cancelled");
            },
            (error) => {
              setIsProcessing(false);
              console.error("Payment error:", error);
              alert("An error occurred during payment");
            }
          );
        } else {
          throw new Error(data.error || "Failed to create payment session");
        }
      } else {
        onSubmit({
          category: category.id,
          registrationId,
          ...formData,
        });
      }
    } catch (error: any) {
      setIsProcessing(false);
      console.error("Registration error:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const steps = [
    { number: 1, title: "Personal Details", icon: User },
    { number: 2, title: "Venue & Payment", icon: CreditCard },
  ];

  return (
    <div className="space-y-8">
      {/* Progress Steps */}
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
              <div
                className={cn(
                  "w-8 h-0.5 mx-2",
                  step > s.number ? "bg-green-500" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Personal Details */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-foreground">Personal Details</h2>
            <p className="text-muted-foreground mt-1">
              Enter your information for {category.name} registration
            </p>
          </div>

          <FieldGroup className="grid gap-6 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="firstName">First Name</FieldLabel>
              <Input
                id="firstName"
                placeholder="Enter your first name"
                value={formData.firstName}
                onChange={(e) => updateFormData("firstName", e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
              <Input
                id="lastName"
                placeholder="Enter your last name"
                value={formData.lastName}
                onChange={(e) => updateFormData("lastName", e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="email">Email Address</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
              <Input
                id="phone"
                type="tel"
                placeholder="+679 XXX XXXX"
                value={formData.phone}
                onChange={(e) => updateFormData("phone", e.target.value)}
              />
            </Field>

            <Field className="md:col-span-2">
              <FieldLabel htmlFor="church">Church Affiliation (Optional)</FieldLabel>
              <Input
                id="church"
                placeholder="Enter your church name if applicable"
                value={formData.church}
                onChange={(e) => updateFormData("church", e.target.value)}
              />
            </Field>
          </FieldGroup>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
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
            <p className="text-muted-foreground mt-1">
              Select your venue and payment method
            </p>
          </div>

          <VenueSelector
            selectedVenue={formData.venue}
            onSelect={(venueId) => updateFormData("venue", venueId)}
          />

          <div className="space-y-3">
            <FieldLabel>Payment Method</FieldLabel>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                onClick={() => updateFormData("paymentMethod", "online")}
                className={cn(
                  "p-4 rounded-lg border text-left transition-all",
                  formData.paymentMethod === "online"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="font-medium text-foreground">Online Payment</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Pay via VaizeePay (M-PAiSA, MyCash, Visa/Mastercard)
                </div>
              </button>
              <button
                onClick={() => updateFormData("paymentMethod", "bank-transfer")}
                className={cn(
                  "p-4 rounded-lg border text-left transition-all",
                  formData.paymentMethod === "bank-transfer"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="font-medium text-foreground">Bank Transfer</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Direct bank-to-bank transfer
                </div>
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="p-4 rounded-lg bg-secondary">
            <h3 className="font-medium text-foreground mb-3">Registration Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="text-foreground">{category.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="text-foreground">
                  {formData.firstName} {formData.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="text-foreground">{formData.email}</span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-2 mt-2 font-semibold">
                <span className="text-foreground">Total Fee</span>
                <span className="text-primary">${category.fee} FJD</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isStep2Valid || !formData.paymentMethod || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                "Complete Registration"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
