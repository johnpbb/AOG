"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { CategoryCard } from "@/components/category-card";
import { ChurchRegistrationForm } from "@/components/church-registration-form";
import { IndividualRegistrationForm } from "@/components/individual-registration-form";
import { RegistrationSuccess } from "@/components/registration-success";
import { REGISTRATION_CATEGORIES, CategoryInfo } from "@/lib/types";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type RegistrationStep = "category" | "form" | "success";

export default function RegisterPage() {
  const [step, setStep] = useState<RegistrationStep>("category");
  const [selectedCategory, setSelectedCategory] = useState<CategoryInfo | null>(null);
  const [registrationData, setRegistrationData] = useState<{
    id: string;
    email: string;
  } | null>(null);

  const handleCategorySelect = (category: CategoryInfo) => {
    setSelectedCategory(category);
  };

  const handleContinue = () => {
    if (selectedCategory) {
      setStep("form");
    }
  };

  const handleFormSubmit = (data: any) => {
    console.log("Registration submitted:", data);
    const formData = data as Record<string, any>;
    setRegistrationData({
      id: formData.registrationId || `AOG100-${Date.now().toString(36).toUpperCase()}`,
      email: formData.email || formData.pastorEmail || "",
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
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          {/* Step: Category Selection */}
          {step === "category" && (
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                  Registration
                </h1>
                <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
                  Select your registration category to begin the process for the
                  AOG Fiji 100th Anniversary Celebration.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Church Registration
                </h2>
                <div className="space-y-3">
                  {REGISTRATION_CATEGORIES.filter((c) => c.type === "church").map(
                    (category) => (
                      <CategoryCard
                        key={category.id}
                        category={category}
                        isSelected={selectedCategory?.id === category.id}
                        onSelect={handleCategorySelect}
                      />
                    )
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Individual Registration
                </h2>
                <div className="space-y-3">
                  {REGISTRATION_CATEGORIES.filter((c) => c.type === "individual").map(
                    (category) => (
                      <CategoryCard
                        key={category.id}
                        category={category}
                        isSelected={selectedCategory?.id === category.id}
                        onSelect={handleCategorySelect}
                      />
                    )
                  )}
                </div>
              </div>

              {selectedCategory && (
                <div className="pt-4">
                  <Button onClick={handleContinue} className="w-full" size="lg">
                    Continue with {selectedCategory.name}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step: Registration Form */}
          {step === "form" && selectedCategory && (
            <div className="space-y-6">
              <Button
                variant="ghost"
                onClick={handleBack}
                className="gap-2 -ml-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Categories
              </Button>

              <div className="p-6 rounded-lg border border-border bg-card">
                {selectedCategory.type === "church" ? (
                  <ChurchRegistrationForm
                    category={selectedCategory}
                    onBack={handleBack}
                    onSubmit={handleFormSubmit}
                  />
                ) : (
                  <IndividualRegistrationForm
                    category={selectedCategory}
                    onBack={handleBack}
                    onSubmit={handleFormSubmit}
                  />
                )}
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === "success" && registrationData && (
            <div className="p-6 rounded-lg border border-border bg-card">
              <RegistrationSuccess
                registrationId={registrationData.id}
                email={registrationData.email}
                onNewRegistration={handleNewRegistration}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
