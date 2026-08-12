"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

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

interface RegistrationDetailsDialogProps {
  registration: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}

export function RegistrationDetailsDialog({ registration, open, onOpenChange }: RegistrationDetailsDialogProps) {
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  useEffect(() => {
    if (!open || !registration) return;
    setLoadingPayments(true);
    fetch(`/api/admin/registrations/${registration.id}/payments`)
      .then((r) => r.json())
      .then((d) => setPayments(d.payments ?? []))
      .finally(() => setLoadingPayments(false));
  }, [open, registration]);

  if (!registration) return null;

  const formData = registration.formData || {};
  const name = `${formData.firstName || ""} ${formData.lastName || ""}`.trim() || registration.email;
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{registration.registrationId}</DialogTitle>
          <DialogDescription>
            {registration.formData?.churchName ?? name} · {registration.category.replace(/-/g, " ")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Section title="Status">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={
                  registration.paymentStatus === "COMPLETED" ? "success"
                  : registration.paymentStatus === "CANCELLED" ? "outline"
                  : "secondary"
                }
              >
                {registration.paymentStatus === "COMPLETED" ? "Confirmed"
                  : registration.paymentStatus === "CANCELLED" ? "Cancelled"
                  : "Pending"}
              </Badge>
              <Badge variant="outline">{registration.paymentMethod?.replace(/_/g, " ")}</Badge>
              {registration.paymentType === "partial" && (
                <Badge variant="outline">Partial · {registration.installmentCount ?? "?"} installments</Badge>
              )}
            </div>
          </Section>

          <Section title="Contact">
            <div className="grid gap-3 md:grid-cols-2 p-3 rounded-lg bg-secondary/50">
              <Field label="Church" value={formData.churchName} />
              <Field label="Registrar" value={registration.registrarName || name} />
              <Field label="Pastor" value={formData.pastorName} />
              <Field label="Email" value={registration.email} />
              <Field label="Phone" value={registration.phone} />
              <Field label="Contact Preference" value={registration.contactPreference} />
              <Field label="Contact Email" value={registration.contactEmail} />
              <Field label="Contact Phone" value={registration.contactPhone} />
              <Field label="Country" value={formData.country} />
            </div>
          </Section>

          <Section title="Attendees">
            <div className="grid grid-cols-3 gap-3 text-sm p-3 rounded-lg bg-secondary/50">
              <div>
                <div className="text-muted-foreground text-xs">Adults</div>
                <div className="font-semibold">{registration.adults}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Youth</div>
                <div className="font-semibold">{registration.youth}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Kids</div>
                <div className="font-semibold">{registration.kids}</div>
              </div>
            </div>
            {registration.attendees?.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {registration.attendees.map((a: any) => (
                  <div key={a.id} className="flex justify-between text-sm p-2 rounded bg-secondary/30">
                    <span>{a.firstName} {a.lastName} <span className="text-xs text-muted-foreground capitalize">({a.ageCategory?.toLowerCase()})</span></span>
                    <span className="text-xs text-muted-foreground">{a.email || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {registration.venueAllocations?.length > 0 && (
            <Section title="Venue Allocations">
              <div className="space-y-1">
                {registration.venueAllocations.map((va: any) => (
                  <div key={va.id} className="flex justify-between text-sm p-2 rounded bg-secondary/30">
                    <span>{va.venue?.name}</span>
                    <span className="text-muted-foreground">{va.count} {va.audienceType}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {registration.tickets?.length > 0 && (
            <Section title={`Tickets (${registration.tickets.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {registration.tickets.map((t: any) => (
                  <Badge key={t.id} variant={t.status === "ACTIVE" ? "outline" : "secondary"} className="font-mono text-xs">
                    {t.ticketNumber}
                  </Badge>
                ))}
              </div>
            </Section>
          )}

          <Section title="Payments">
            <div className="grid grid-cols-3 gap-3 text-sm p-3 rounded-lg bg-secondary">
              <div>
                <div className="text-muted-foreground text-xs">Total Fee</div>
                <div className="font-semibold">${registration.fee.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Paid</div>
                <div className="font-semibold">${totalPaid.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Remaining</div>
                <div className="font-semibold text-primary">${Math.max(0, registration.fee - totalPaid).toLocaleString()}</div>
              </div>
            </div>
            {loadingPayments ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments logged yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm p-2 rounded bg-secondary/30">
                    <div>
                      <span className="font-medium">${p.amount.toLocaleString()}</span>
                      <span className="text-muted-foreground"> · {p.method} · {p.entryType}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(p.confirmedAt), "yyyy-MM-dd")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Timeline">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Submitted" value={format(new Date(registration.createdAt), "yyyy-MM-dd HH:mm")} />
              <Field label="Last Updated" value={format(new Date(registration.updatedAt), "yyyy-MM-dd HH:mm")} />
            </div>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
