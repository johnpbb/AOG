"use client";

import { INSTALLMENT_OPTIONS, INSTALLMENT_DEADLINE } from "@/lib/types";
import { FieldLabel } from "@/components/ui/field";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentTypeSelectorProps {
  paymentType: "full" | "partial";
  onPaymentTypeChange: (type: "full" | "partial") => void;
  installmentCount: number;
  onInstallmentCountChange: (count: number) => void;
  totalFee: number;
}

const deadlineLabel = INSTALLMENT_DEADLINE.toLocaleDateString("en-FJ", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function PaymentTypeSelector({
  paymentType,
  onPaymentTypeChange,
  installmentCount,
  onInstallmentCountChange,
  totalFee,
}: PaymentTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <FieldLabel>Payment Type</FieldLabel>
      <div className="grid gap-3 md:grid-cols-2">
        {(["full", "partial"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onPaymentTypeChange(t)}
            className={cn(
              "p-4 rounded-lg border text-left transition-all",
              paymentType === t ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
            )}
          >
            <div className="font-medium text-foreground">{t === "full" ? "Full Payment" : "Partial Payment"}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {t === "full" ? "Pay the full registration fee in one payment." : "Pay in installments over several payments."}
            </div>
          </button>
        ))}
      </div>

      {paymentType === "partial" && (
        <div className="space-y-3 p-4 rounded-lg border border-border bg-secondary/30">
          <div>
            <FieldLabel htmlFor="installmentCount">Number of Installments</FieldLabel>
            <Select value={String(installmentCount)} onValueChange={(v) => onInstallmentCountChange(parseInt(v, 10))}>
              <SelectTrigger><SelectValue placeholder="Select installments" /></SelectTrigger>
              <SelectContent>
                {INSTALLMENT_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} installments</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {totalFee > 0 && (
            <p className="text-sm text-muted-foreground">
              Approximately ${(totalFee / installmentCount).toFixed(2)} FJD per installment.
            </p>
          )}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              All installments must be fully paid by <span className="font-semibold">{deadlineLabel}</span>.
              Your entry QR codes will be issued once the full fee has been paid.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
