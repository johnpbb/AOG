"use client";

import { HelpCircle } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { GLOSSARY_TERMS } from "@/lib/types";

// Persistent "Glossary of Terms" — accessible from every step of registration,
// defining category tiers, age brackets, and acronyms in plain language.
export function GlossarySidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Glossary of Terms"
          className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand-orange text-white shadow-lg hover:bg-brand-orange/90 transition-colors"
        >
          <HelpCircle className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Glossary of Terms</SheetTitle>
          <SheetDescription>
            Definitions for registration categories, age brackets, and acronyms used in this form.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6 space-y-4 overflow-y-auto">
          {GLOSSARY_TERMS.map((g) => (
            <div key={g.term}>
              <p className="text-sm font-medium text-foreground">{g.term}</p>
              <p className="text-sm text-muted-foreground">{g.definition}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
