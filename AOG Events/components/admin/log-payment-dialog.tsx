"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface PaymentEntry {
  id: string;
  amount: number;
  entryType: string;
  method: string;
  referenceNote: string | null;
  installmentNo: number | null;
  confirmedAt: string;
  confirmedBy: { name: string } | null;
}

interface LogPaymentDialogProps {
  registrationId: string; // internal id
  registrationLabel: string; // human-readable reference (registrationId field)
  fee: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged: () => void;
}

export function LogPaymentDialog({ registrationId, registrationLabel, fee, open, onOpenChange, onLogged }: LogPaymentDialogProps) {
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [amount, setAmount] = useState("");
  const [entryType, setEntryType] = useState<"FULL" | "INSTALLMENT">("INSTALLMENT");
  const [method, setMethod] = useState<"BANK_TRANSFER" | "MPAISA" | "WORLD_REMIT" | "CASH" | "ONLINE">("BANK_TRANSFER");
  const [referenceNote, setReferenceNote] = useState("");
  const [installmentNo, setInstallmentNo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadHistory() {
    setLoadingHistory(true);
    fetch(`/api/admin/registrations/${registrationId}/payments`)
      .then((r) => r.json())
      .then((d) => setPayments(d.payments ?? []))
      .finally(() => setLoadingHistory(false));
  }

  useEffect(() => {
    if (open) loadHistory();
  }, [open, registrationId]);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, fee - totalPaid);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/registrations/${registrationId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(amount),
        entryType,
        method,
        referenceNote,
        installmentNo: installmentNo ? parseInt(installmentNo, 10) : null,
      }),
    });
    if (res.ok) {
      setAmount("");
      setReferenceNote("");
      setInstallmentNo("");
      loadHistory();
      onLogged();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to log payment");
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Payment — {registrationLabel}</DialogTitle>
          <DialogDescription>
            Record a bank transfer, cash, or other offline payment receipt against this registration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm p-3 rounded-lg bg-secondary">
            <div>
              <div className="text-muted-foreground text-xs">Total Fee</div>
              <div className="font-semibold">${fee.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Amount Paid</div>
              <div className="font-semibold">${totalPaid.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Remaining</div>
              <div className="font-semibold text-primary">${remaining.toLocaleString()}</div>
            </div>
          </div>

          <FieldGroup className="grid gap-3 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="amount">Amount (FJD)</FieldLabel>
              <Input id="amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="installmentNo">Installment # (optional)</FieldLabel>
              <Input id="installmentNo" type="number" min={1} value={installmentNo} onChange={(e) => setInstallmentNo(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Payment Type</FieldLabel>
              <Select value={entryType} onValueChange={(v) => setEntryType(v as typeof entryType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSTALLMENT">Installment</SelectItem>
                  <SelectItem value="FULL">Lump Sum / Full</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Method</FieldLabel>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="MPAISA">M-PAiSA</SelectItem>
                  <SelectItem value="WORLD_REMIT">World Remit to M-PAiSA</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="ONLINE">Online (disabled)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="referenceNote">Reference / Receipt Details</FieldLabel>
              <Input id="referenceNote" placeholder="Bank ref, receipt no., teller, branch, notes…"
                value={referenceNote} onChange={(e) => setReferenceNote(e.target.value)} />
            </Field>
          </FieldGroup>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div>
            <p className="text-sm font-medium text-foreground mb-2">Payment History (Audit Trail)</p>
            {loadingHistory ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments logged yet.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm p-2 rounded bg-secondary/50">
                    <div>
                      <span className="font-medium">${p.amount.toLocaleString()}</span>
                      <span className="text-muted-foreground"> · {p.method} · {p.entryType}</span>
                      {p.referenceNote && <div className="text-xs text-muted-foreground">{p.referenceNote}</div>}
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      Confirmed by: {p.confirmedBy?.name ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!amount || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Log Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
