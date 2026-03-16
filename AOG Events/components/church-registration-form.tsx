"use client";

import { useState } from "react";
import { CategoryInfo, DISTRICTS, Attendee } from "@/lib/types";
import { VenueSelector } from "./venue-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Building, CreditCard, Loader2, Plus, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadAnzScript, initAnzPayment } from "@/lib/anz-egate-client";

interface ChurchRegistrationFormProps {
  category: CategoryInfo;
  onBack: () => void;
  onSubmit: (data: unknown) => void;
}

export function ChurchRegistrationForm({
  category,
  onBack,
  onSubmit,
}: ChurchRegistrationFormProps) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    churchName: "",
    district: "",
    pastorName: "",
    pastorEmail: "",
    pastorPhone: "",
    venue: "",
    paymentMethod: "" as "online" | "bank-transfer" | "",
  });
  const [attendees, setAttendees] = useState<Attendee[]>([
    { firstName: "", lastName: "", email: "", phone: "" },
  ]);

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addAttendee = () => {
    setAttendees((prev) => [
      ...prev,
      { firstName: "", lastName: "", email: "", phone: "" },
    ]);
  };

  const removeAttendee = (index: number) => {
    if (attendees.length > 1) {
      setAttendees((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updateAttendee = (index: number, field: keyof Attendee, value: string) => {
    setAttendees((prev) =>
      prev.map((attendee, i) =>
        i === index ? { ...attendee, [field]: value } : attendee
      )
    );
  };

  const isStep1Valid =
    formData.churchName &&
    formData.district &&
    formData.pastorName &&
    formData.pastorEmail &&
    formData.pastorPhone;

  const isStep2Valid = attendees.every(
    (a) => a.firstName && a.lastName
  );

  const isStep3Valid = formData.venue !== "";

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
          type: "church",
          email: formData.pastorEmail,
          phone: formData.pastorPhone,
          fee: category.fee,
          attendees,
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
            customerEmail: formData.pastorEmail
          })
        });

        const data = await response.json();
        
        if (data.sessionId) {
          initAnzPayment(
            data.sessionId,
            data.merchantId,
            (resultIndicator, sessionVersion) => {
              onSubmit({
                category: category.id,
                registrationId,
                ...formData,
                attendees,
                numberOfAttendees: attendees.length,
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
          attendees,
          numberOfAttendees: attendees.length,
        });
      }
    } catch (error: any) {
      setIsProcessing(false);
      console.error("Registration error:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const steps = [
    { number: 1, title: "Church Details", icon: Building },
    { number: 2, title: "Attendees", icon: Users },
    { number: 3, title: "Venue & Payment", icon: CreditCard },
  ];

  return (
    <div className="space-y-8">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, index) => (
          <div key={s.number} className="flex items-center">
            <button
              onClick={() => setStep(s.number)}
              disabled={
                (s.number === 2 && !isStep1Valid) ||
                (s.number === 3 && (!isStep1Valid || !isStep2Valid))
              }
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

      {/* Step 1: Church Details */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-foreground">Church Details</h2>
            <p className="text-muted-foreground mt-1">
              Enter your church information for {category.name}
            </p>
          </div>

          <FieldGroup className="grid gap-6 md:grid-cols-2">
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="churchName">Church Name</FieldLabel>
              <Input
                id="churchName"
                placeholder="Enter your church name"
                value={formData.churchName}
                onChange={(e) => updateFormData("churchName", e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="district">District</FieldLabel>
              <Select
                value={formData.district}
                onValueChange={(value) => updateFormData("district", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {DISTRICTS.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="pastorName">Pastor / Leader Name</FieldLabel>
              <Input
                id="pastorName"
                placeholder="Full name"
                value={formData.pastorName}
                onChange={(e) => updateFormData("pastorName", e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="pastorEmail">Email Address</FieldLabel>
              <Input
                id="pastorEmail"
                type="email"
                placeholder="email@example.com"
                value={formData.pastorEmail}
                onChange={(e) => updateFormData("pastorEmail", e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="pastorPhone">Phone Number</FieldLabel>
              <Input
                id="pastorPhone"
                type="tel"
                placeholder="+679 XXX XXXX"
                value={formData.pastorPhone}
                onChange={(e) => updateFormData("pastorPhone", e.target.value)}
              />
            </Field>
          </FieldGroup>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button onClick={() => setStep(2)} disabled={!isStep1Valid}>
              Continue to Attendees
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Attendees */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-foreground">Attendee Information</h2>
            <p className="text-muted-foreground mt-1">
              Add all attendees from your church
            </p>
          </div>

          <div className="space-y-4">
            {attendees.map((attendee, index) => (
              <div
                key={index}
                className="p-4 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-foreground">
                    Attendee {index + 1}
                  </span>
                  {attendees.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttendee(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor={`firstName-${index}`}>First Name</Label>
                    <Input
                      id={`firstName-${index}`}
                      placeholder="First name"
                      value={attendee.firstName}
                      onChange={(e) =>
                        updateAttendee(index, "firstName", e.target.value)
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`lastName-${index}`}>Last Name</Label>
                    <Input
                      id={`lastName-${index}`}
                      placeholder="Last name"
                      value={attendee.lastName}
                      onChange={(e) =>
                        updateAttendee(index, "lastName", e.target.value)
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`email-${index}`}>Email (Optional)</Label>
                    <Input
                      id={`email-${index}`}
                      type="email"
                      placeholder="email@example.com"
                      value={attendee.email || ""}
                      onChange={(e) =>
                        updateAttendee(index, "email", e.target.value)
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`phone-${index}`}>Phone (Optional)</Label>
                    <Input
                      id={`phone-${index}`}
                      type="tel"
                      placeholder="+679 XXX XXXX"
                      value={attendee.phone || ""}
                      onChange={(e) =>
                        updateAttendee(index, "phone", e.target.value)
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" onClick={addAttendee} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Attendee
          </Button>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={!isStep2Valid}>
              Continue to Venue
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Venue & Payment */}
      {step === 3 && (
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
            <Label>Payment Method</Label>
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
                <div className="font-medium">Online Payment</div>
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
                <div className="font-medium">Bank Transfer</div>
                <div className="text-sm text-muted-foreground mt-1">
                  For large transactions via bank-to-bank transfer
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
                <span className="text-muted-foreground">Church</span>
                <span className="text-foreground">{formData.churchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Attendees</span>
                <span className="text-foreground">{attendees.length}</span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-2 mt-2 font-semibold">
                <span className="text-foreground">Total Fee</span>
                <span className="text-primary">${category.fee} FJD</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isStep3Valid || !formData.paymentMethod || isProcessing}
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
