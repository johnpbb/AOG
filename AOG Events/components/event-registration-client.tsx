"use client";

import { useState } from "react";
import { CategoryCard } from "@/components/category-card";
import { ChurchRegistrationForm } from "@/components/church-registration-form";
import { IndividualRegistrationForm } from "@/components/individual-registration-form";
import { RegistrationSuccess } from "@/components/registration-success";
import { REGISTRATION_CATEGORIES, CategoryInfo } from "@/lib/types";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
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

type RegistrationStep = "category" | "form" | "success";

export function EventRegistrationClient({ event }: Props) {
  const [step, setStep] = useState<RegistrationStep>("category");
  const [selectedCategory, setSelectedCategory] = useState<CategoryInfo | null>(null);
  const [registrationData, setRegistrationData] = useState<{
    id: string;
    email: string;
    paymentMethod?: string;
    fee?: number;
    numberOfTickets?: number;
  } | null>(null);

  const handleCategorySelect = (category: CategoryInfo) => {
    setSelectedCategory(category);
  };

  const handleContinue = () => {
    if (selectedCategory) setStep("form");
  };

  const handleFormSubmit = (data: any) => {
    const formData = data as Record<string, any>;
    setRegistrationData({
      id: formData.registrationId || `AOG-${Date.now().toString(36).toUpperCase()}`,
      email: formData.email || formData.pastorEmail || "",
      paymentMethod: formData.paymentMethod,
      fee: formData.fee,
      numberOfTickets: formData.numberOfTickets,
    });
    setStep("success");
  };

  const handleNewRegistration = () => {
    setStep("category");
    setSelectedCategory(null);
    setRegistrationData(null);
  };

  const handleBack = () => {
    setStep("category");
  };

  return (
    <div className="space-y-8">
      {step === "category" && (
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
              Select your registration category to begin.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Church Registration
            </h2>
            <div className="space-y-3">
              {REGISTRATION_CATEGORIES.filter((c) => c.type === "church").map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  isSelected={selectedCategory?.id === category.id}
                  onSelect={handleCategorySelect}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Individual Registration
            </h2>
            <div className="space-y-3">
              {REGISTRATION_CATEGORIES.filter((c) => c.type === "individual").map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  isSelected={selectedCategory?.id === category.id}
                  onSelect={handleCategorySelect}
                />
              ))}
            </div>
          </div>

          {selectedCategory && (
            <div className="pt-4">
              <Button onClick={handleContinue} className="w-full" size="lg" style={{ backgroundColor: "rgb(255, 108, 0)", color: "white" }}>
                Continue with {selectedCategory.name}
              </Button>
            </div>
          )}
        </div>
      )}

      {step === "form" && selectedCategory && (
        <div className="space-y-6">
          <Button variant="ghost" onClick={handleBack} className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Categories
          </Button>

          <div className="p-6 rounded-lg border border-border bg-card">
            {selectedCategory.type === "church" ? (
              <ChurchRegistrationForm
                category={selectedCategory}
                onBack={handleBack}
                onSubmit={handleFormSubmit}
                eventId={event.id}
                venues={event.venues}
              />
            ) : (
              <IndividualRegistrationForm
                category={selectedCategory}
                onBack={handleBack}
                onSubmit={handleFormSubmit}
                eventId={event.id}
                venues={event.venues}
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
            onNewRegistration={handleNewRegistration}
          />
        </div>
      )}
    </div>
  );
}
