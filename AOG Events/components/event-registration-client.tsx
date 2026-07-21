"use client";

import { useState } from "react";
import { CategoryCard } from "@/components/category-card";
import { ChurchRegistrationForm } from "@/components/church-registration-form";
import { IndividualRegistrationForm } from "@/components/individual-registration-form";
import { RegistrationSuccess } from "@/components/registration-success";
import { ChurchAutocomplete, ChurchOption } from "@/components/church-autocomplete";
import { GlossarySidebar } from "@/components/glossary-sidebar";
import { REGISTRATION_CATEGORIES, CategoryInfo } from "@/lib/types";
import { ArrowLeft, CalendarDays, MapPin, Building, Globe, User } from "lucide-react";
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

type RegistrationPath = "church" | "individual" | "wfc";
type RegistrationStep = "entry" | "category" | "form" | "success";

const WFC_COUNTRIES = ["Australia", "New Zealand", "USA", "United Kingdom"];

export function EventRegistrationClient({ event }: Props) {
  const [step, setStep] = useState<RegistrationStep>("entry");
  const [path, setPath] = useState<RegistrationPath | null>(null);
  const [selectedChurch, setSelectedChurch] = useState<ChurchOption | null>(null);
  const [wfcCountry, setWfcCountry] = useState(WFC_COUNTRIES[0]);
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

  const categoriesForPath = (() => {
    if (path === "church") {
      return REGISTRATION_CATEGORIES.filter((c) => c.type === "church" && c.id !== "world-fijian-congress");
    }
    if (path === "wfc") {
      return REGISTRATION_CATEGORIES.filter((c) => c.id === "world-fijian-congress");
    }
    if (path === "individual") {
      return REGISTRATION_CATEGORIES.filter((c) => c.type === "individual");
    }
    return [];
  })();

  const handleCategorySelect = (category: CategoryInfo) => {
    setSelectedCategory(category);
    setStep("form");
  };

  const handleEntryContinue = () => {
    if (!path) return;
    if ((path === "church" || path === "wfc") && !selectedChurch) return;

    // If we know the church's HQ-reported size, skip straight to the form
    // instead of making them click through a category step for a choice
    // that's already made — they can still change it via "Back to
    // Categories" on the form if it's wrong.
    const knownCategory = selectedChurch?.category
      ? categoriesForPath.find((c) => c.id === selectedChurch.category)
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

  const handleBackToCategory = () => setStep("category");

  const stepLabels: Record<typeof step, string> = {
    entry: "Step 1 of 3: Who are you registering?",
    category: "Step 2 of 3: Select Category",
    form: "Step 3 of 3: Registration Form",
    success: "Registration submitted",
  };

  return (
    <div className="space-y-8">
      <GlossarySidebar />
      <div role="status" aria-live="polite" className="sr-only">{stepLabels[step]}</div>

      {step === "entry" && (
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Register</h1>
            <p className="mt-2 text-muted-foreground font-medium">{event.name}</p>
            <div className="flex items-center justify-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.location}
                </span>
              )}
              {event.startDate && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(event.startDate).toLocaleDateString("en-FJ", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              First, tell us who you're registering on behalf of.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <button
              onClick={() => { setPath("church"); setSelectedChurch(null); }}
              className={`p-4 rounded-lg border text-left transition-all ${path === "church" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
            >
              <Building className="h-5 w-5 text-muted-foreground mb-2" />
              <p className="font-medium text-foreground">AG Fiji Church</p>
              <p className="text-sm text-muted-foreground mt-1">Registering on behalf of a local AG Fiji church.</p>
            </button>
            <button
              onClick={() => { setPath("individual"); setSelectedChurch(null); }}
              className={`p-4 rounded-lg border text-left transition-all ${path === "individual" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
            >
              <User className="h-5 w-5 text-muted-foreground mb-2" />
              <p className="font-medium text-foreground">Individual / Missionary</p>
              <p className="text-sm text-muted-foreground mt-1">International guests, missionaries, or anyone who doesn't fit a local church category.</p>
            </button>
            <button
              onClick={() => { setPath("wfc"); setSelectedChurch(null); }}
              className={`p-4 rounded-lg border text-left transition-all ${path === "wfc" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
            >
              <Globe className="h-5 w-5 text-muted-foreground mb-2" />
              <p className="font-medium text-foreground">World Fijian Congress</p>
              <p className="text-sm text-muted-foreground mt-1">Overseas Fijian church network — Australia, New Zealand, USA, Great Britain.</p>
            </button>
          </div>

          {path === "church" && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Find your church</p>
              <ChurchAutocomplete value={selectedChurch} onSelect={setSelectedChurch} />
            </div>
          )}

          {path === "wfc" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Country</p>
              <div className="flex gap-2 flex-wrap">
                {WFC_COUNTRIES.map((c) => (
                  <button key={c} onClick={() => { setWfcCountry(c); setSelectedChurch(null); }}
                    className={`px-3 py-1.5 rounded-full text-sm border ${wfcCountry === c ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}>
                    {c}
                  </button>
                ))}
              </div>
              <p className="text-sm font-medium text-foreground">Find your church</p>
              <ChurchAutocomplete value={selectedChurch} onSelect={setSelectedChurch} country={wfcCountry} />
            </div>
          )}

          {path && (
            <div className="pt-2">
              <Button
                onClick={handleEntryContinue}
                disabled={(path === "church" || path === "wfc") && !selectedChurch}
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
          <Button variant="ghost" onClick={handleBackToEntry} className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

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
            {categoriesForPath.map((category) => (
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
          <Button variant="ghost" onClick={handleBackToCategory} className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Categories
          </Button>

          <div className="p-6 rounded-lg border border-border bg-card">
            {selectedCategory.type === "church" ? (
              <ChurchRegistrationForm
                category={selectedCategory}
                church={selectedChurch}
                onBack={handleBackToCategory}
                onCancel={handleCancel}
                onSubmit={handleFormSubmit}
                eventId={event.id}
              />
            ) : (
              <IndividualRegistrationForm
                category={selectedCategory}
                onBack={handleBackToCategory}
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
