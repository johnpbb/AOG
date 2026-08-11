"use client";

import { useState } from "react";
import Link from "next/link";
import { CategoryCard } from "@/components/category-card";
import { ChurchRegistrationForm } from "@/components/church-registration-form";
import { IndividualRegistrationForm } from "@/components/individual-registration-form";
import { RegistrationSuccess } from "@/components/registration-success";
import { ChurchAutocomplete, ChurchOption } from "@/components/church-autocomplete";
import { GlossarySidebar } from "@/components/glossary-sidebar";
import { REGISTRATION_CATEGORIES, CategoryInfo } from "@/lib/types";
import { ArrowLeft, Building, User, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Venue {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  capacity: number;
  currentRegistrations: number;
  isActive: boolean;
}

interface Event {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  startDate: string | null;
  venues: Venue[];
}

interface Props {
  event: Event;
}

type RegistrationPath = "church" | "individual" | "overseas";
type RegistrationStep = "entry" | "category" | "form" | "success";

export function EventRegistrationClient({ event }: Props) {
  const [step, setStep] = useState<RegistrationStep>("entry");
  const [path, setPath] = useState<RegistrationPath | null>(null);
  const [selectedChurch, setSelectedChurch] = useState<ChurchOption | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryInfo | null>(null);
  const [registrationData, setRegistrationData] = useState<{
    id: string;
    email: string;
    paymentMethod?: string;
    fee?: number;
    numberOfTickets?: number;
    paymentType?: string;
    installmentCount?: number | null;
  } | null>(null);

  // The category step (church-size picker) now only ever applies to the
  // church path — Individual and Overseas are single categories
  // selected directly at entry, so they skip it entirely.
  const churchCategories = REGISTRATION_CATEGORIES.filter((c) => c.type === "church");

  const handleCategorySelect = (category: CategoryInfo) => {
    setSelectedCategory(category);
    setStep("form");
  };

  const handleEntryContinue = () => {
    if (!path) return;
    if (path === "church" && !selectedChurch) return;

    if (path === "individual" || path === "overseas") {
      const category = REGISTRATION_CATEGORIES.find(
        (c) => c.id === (path === "individual" ? "individual" : "overseas")
      );
      setSelectedCategory(category ?? null);
      setStep("form");
      return;
    }

    // If we know the church's HQ-reported size, skip straight to the form
    // instead of making them click through a category step for a choice
    // that's already made — they can still change it via "Back to
    // Categories" on the form if it's wrong.
    const knownCategory = selectedChurch?.category
      ? churchCategories.find((c) => c.id === selectedChurch.category)
      : undefined;

    if (knownCategory) {
      setSelectedCategory(knownCategory);
      setStep("form");
    } else {
      setSelectedCategory(null);
      setStep("category");
    }
  };

  const handleFormSubmit = (data: any) => {
    const formData = data as Record<string, any>;
    setRegistrationData({
      id: formData.registrationId,
      email: formData.email || formData.contactEmail || formData.pastorEmail || "",
      paymentMethod: formData.paymentMethod,
      fee: formData.fee,
      numberOfTickets: formData.numberOfTickets,
      paymentType: formData.paymentType,
      installmentCount: formData.installmentCount,
    });
    setStep("success");
  };

  const resetAll = () => {
    setStep("entry");
    setPath(null);
    setSelectedChurch(null);
    setSelectedCategory(null);
    setRegistrationData(null);
  };

  const handleCancel = () => {
    if (window.confirm("Cancel this registration? Anything you've entered will be lost.")) {
      resetAll();
    }
  };

  const handleBackToEntry = () => {
    setStep("entry");
    setSelectedCategory(null);
  };

  // Only the church path can pass through the category step, so "of 3" vs
  // "of 2" depends on which entry option was picked.
  const totalSteps = path === "church" ? 3 : 2;
  const stepLabels: Record<typeof step, string> = {
    entry: `Step 1 of ${totalSteps}: Who are you registering?`,
    category: "Step 2 of 3: Select Category",
    form: `Step ${totalSteps} of ${totalSteps}: Registration Form`,
    success: "Registration submitted",
  };

  return (
    <div className="space-y-8">
      <GlossarySidebar />
      <div role="status" aria-live="polite" className="sr-only">{stepLabels[step]}</div>

      {step === "entry" && (
        <Link
          href={`/events/${event.slug}`}
          className="inline-flex items-center gap-2 bg-brand-orange text-brand-white text-sm font-bold px-4 py-2 rounded-lg no-underline w-fit tracking-[0.02em] hover:bg-brand-orange/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      )}
      {step === "category" && (
        <Button
          onClick={handleBackToEntry}
          className="gap-2 bg-brand-orange text-brand-white font-bold tracking-[0.02em] hover:bg-brand-orange/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      )}
      {step === "form" && (
        <Button
          onClick={handleBackToEntry}
          className="gap-2 bg-brand-orange text-brand-white font-bold tracking-[0.02em] hover:bg-brand-orange/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      )}

      {step === "entry" && (
        <div className="space-y-8">
          <div className="text-center">
            <p className="text-muted-foreground max-w-xl mx-auto">
              First, tell us who you're registering on behalf of.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <button
              onClick={() => { setPath("church"); setSelectedChurch(null); }}
              className={`p-4 rounded-lg border text-left transition-all ${path === "church" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
            >
              <Building className="h-5 w-5 text-muted-foreground mb-2" />
              <p className="font-medium text-foreground">AOG Fiji Based Church</p>
              <p className="text-sm text-muted-foreground mt-1">Registering on behalf of a local AG Fiji church.</p>
            </button>
            <button
              onClick={() => { setPath("individual"); setSelectedChurch(null); }}
              className={`p-4 rounded-lg border text-left transition-all ${path === "individual" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
            >
              <User className="h-5 w-5 text-muted-foreground mb-2" />
              <p className="font-medium text-foreground">Individual</p>
              <p className="text-sm text-muted-foreground mt-1">Personal registration — register yourself and up to 9 friends or family.</p>
            </button>
            <button
              onClick={() => { setPath("overseas"); setSelectedChurch(null); }}
              className={`p-4 rounded-lg border text-left transition-all ${path === "overseas" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
            >
              <Globe className="h-5 w-5 text-muted-foreground mb-2" />
              <p className="font-medium text-foreground">Overseas</p>
              <p className="text-sm text-muted-foreground mt-1">International guests attending from outside Fiji.</p>
            </button>
          </div>

          {path === "church" && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Find your church</p>
              <ChurchAutocomplete value={selectedChurch} onSelect={setSelectedChurch} />
            </div>
          )}

          {path && (
            <div className="pt-2">
              <Button
                onClick={handleEntryContinue}
                disabled={path === "church" && !selectedChurch}
                className="w-full bg-brand-orange text-brand-white hover:bg-brand-orange/90"
                size="lg"
              >
                Continue
              </Button>
            </div>
          )}
        </div>
      )}

      {step === "category" && (
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-foreground">Select Category</h2>
            <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
              Choose the category that matches your registration.
            </p>
            {selectedCategory && selectedChurch?.category === selectedCategory.id && (
              <p className="mt-1 text-xs text-muted-foreground max-w-xl mx-auto">
                We've pre-selected {selectedCategory.name} based on our records for {selectedChurch.name} —
                change it below if that's not right.
              </p>
            )}
          </div>

          <div className="space-y-3">
            {churchCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                isSelected={selectedCategory?.id === category.id}
                onSelect={handleCategorySelect}
              />
            ))}
          </div>
        </div>
      )}

      {step === "form" && selectedCategory && (
        <div className="space-y-6">
          <div className="p-6 rounded-lg border border-border bg-card">
            {selectedCategory.type === "church" ? (
              <ChurchRegistrationForm
                category={selectedCategory}
                church={selectedChurch}
                onBack={handleBackToEntry}
                onCancel={handleCancel}
                onSubmit={handleFormSubmit}
                eventId={event.id}
              />
            ) : (
              <IndividualRegistrationForm
                category={selectedCategory}
                onBack={handleBackToEntry}
                onCancel={handleCancel}
                onSubmit={handleFormSubmit}
                eventId={event.id}
              />
            )}
          </div>
        </div>
      )}

      {step === "success" && registrationData && (
        <div className="p-6 rounded-lg border border-border bg-card">
          <RegistrationSuccess
            registrationId={registrationData.id}
            email={registrationData.email}
            paymentMethod={registrationData.paymentMethod}
            fee={registrationData.fee}
            numberOfTickets={registrationData.numberOfTickets}
            paymentType={registrationData.paymentType}
            installmentCount={registrationData.installmentCount}
            onNewRegistration={resetAll}
          />
        </div>
      )}
    </div>
  );
}
