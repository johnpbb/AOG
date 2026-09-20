"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AttendeeCsvUpload } from "@/components/attendee-csv-upload";

type Attendee = { firstName: string; lastName: string; ageCategory: "ADULT" | "YOUTH"; email?: string; phone?: string };

interface AmendRegistrationDialogProps {
  registration: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAmended: () => void;
}

function CountField({ label, hint, value, onChange, disabled }: {
  label: string; hint: string; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function AmendRegistrationDialog({ registration, open, onOpenChange, onAmended }: AmendRegistrationDialogProps) {
  const [adults, setAdults] = useState("0");
  const [youth, setYouth] = useState("0");
  const [kids, setKids] = useState("0");
  const [attendees, setAttendees] = useState<Attendee[] | null>(null);
  const [replaceNames, setReplaceNames] = useState(false);
  const [note, setNote] = useState("");
  const [resendTickets, setResendTickets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset to the registration's current figures each time the dialog opens,
  // so a previous edit's abandoned values never leak into the next one.
  useEffect(() => {
    if (!open || !registration) return;
    setAdults(String(registration.adults ?? 0));
    setYouth(String(registration.youth ?? 0));
    setKids(String(registration.kids ?? 0));
    setAttendees(null);
    setReplaceNames(false);
    setNote("");
    setResendTickets(true);
    setError(null);
  }, [open, registration]);

  const activeTickets = useMemo(
    () => (registration?.tickets ?? []).filter((t: any) => t.status === "ACTIVE"),
    [registration]
  );
  const ticketsIssued = activeTickets.length > 0;
  const isPaid = registration?.paymentStatus === "COMPLETED";

  if (!registration) return null;

  const nA = parseInt(adults, 10) || 0;
  const nY = parseInt(youth, 10) || 0;
  const nK = parseInt(kids, 10) || 0;
  const newTotal = nA + nY + nK;
  const oldTotal = (registration.adults ?? 0) + (registration.youth ?? 0) + (registration.kids ?? 0);
  const ticketDelta = nA + nY - activeTickets.length;

  // Church fees are flat per category; only individual/overseas scale per head.
  const feeMoves = registration.type === "INDIVIDUAL";
  // Matching the server rule in lib/amend-registration.ts: a paid individual's
  // headcount is locked, because its fee is per-head and this tool never moves
  // paymentStatus. Names stay editable.
  const headcountLocked = feeMoves && isPaid;

  const namesMismatch =
    replaceNames && attendees !== null &&
    (attendees.filter((a) => a.ageCategory === "ADULT").length !== nA ||
      attendees.filter((a) => a.ageCategory === "YOUTH").length !== nY);

  const canSubmit =
    newTotal > 0 && !submitting && !namesMismatch && (!replaceNames || attendees !== null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/registrations/${registration.id}/amend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adults: nA,
          youth: nY,
          kids: nK,
          attendees: replaceNames ? attendees : null,
          note: note.trim() || null,
          resendTickets: resendTickets && ticketsIssued,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to amend registration");
      toast.success(data.message);
      if (data.emailError) toast.warning(data.emailError);
      onAmended();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Amend {registration.registrationId}</DialogTitle>
          <DialogDescription>
            {registration.formData?.churchName ?? registration.email} · {registration.category?.replace(/-/g, " ")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {isPaid && (
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                This registration is already paid and has {activeTickets.length} active ticket(s).
                Existing tickets keep their numbers and QR codes — only the difference is issued or cancelled.
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-foreground mb-2">Headcount</p>
            <div className="grid grid-cols-3 gap-3">
              <CountField label="Adults" hint={`now ${registration.adults ?? 0}`} value={adults} onChange={setAdults} disabled={headcountLocked} />
              <CountField label="Youth" hint={`now ${registration.youth ?? 0}`} value={youth} onChange={setYouth} disabled={headcountLocked} />
              <CountField label="Kids" hint={`now ${registration.kids ?? 0} · no ticket`} value={kids} onChange={setKids} disabled={headcountLocked} />
            </div>

            {headcountLocked && (
              <p className="text-xs text-muted-foreground mt-2">
                Headcount is locked: this registration is paid and its fee is charged per attendee,
                so changing the numbers here would leave the amount owing out of step with what&apos;s
                been received. You can still update the attendee names below.
              </p>
            )}

            <div className="flex items-center gap-3 mt-3 text-sm flex-wrap">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{oldTotal}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold text-primary">{newTotal}</span>
              {ticketsIssued && ticketDelta !== 0 && (
                <Badge variant="outline">
                  {ticketDelta > 0 ? `+${ticketDelta} ticket(s) to issue` : `${Math.abs(ticketDelta)} ticket(s) to cancel`}
                </Badge>
              )}
              {feeMoves && !headcountLocked && newTotal !== oldTotal && (
                <Badge variant="outline" className="border-amber-300 text-amber-800">Fee will be recalculated</Badge>
              )}
            </div>
            {newTotal <= 0 && (
              <p className="text-destructive text-xs mt-2">A registration needs at least one attendee. Use Cancel Registration instead.</p>
            )}
          </div>

          <div className="space-y-3 pt-1 border-t border-border">
            <div className="flex items-start gap-2 pt-3">
              <Checkbox
                id="replace-names"
                checked={replaceNames}
                onCheckedChange={(v) => { setReplaceNames(!!v); setAttendees(null); }}
              />
              <div className="grid gap-0.5">
                <Label htmlFor="replace-names" className="cursor-pointer">Upload the attendee name list</Label>
                <p className="text-xs text-muted-foreground">
                  {registration.attendees?.length > 0
                    ? `Replaces the ${registration.attendees.length} name(s) currently on file and re-points them at the existing tickets.`
                    : "Names the people on each ticket. Leave unchecked to keep this registration headcount-only."}
                </p>
              </div>
            </div>

            {replaceNames && (
              <div className="pl-6">
                <AttendeeCsvUpload onChange={setAttendees} />
                {namesMismatch && attendees && (
                  <p className="text-destructive text-xs mt-2">
                    The list names {attendees.filter((a) => a.ageCategory === "ADULT").length} adult(s) and{" "}
                    {attendees.filter((a) => a.ageCategory === "YOUTH").length} youth, but the headcount above is set to{" "}
                    {nA} adult(s) and {nY} youth. These must match.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Reason for the change (recorded against the registration)</Label>
            <Textarea
              rows={2}
              placeholder="e.g. Church confirmed final numbers by phone, 18 Sep"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {ticketsIssued && (
            <div className="flex items-start gap-2">
              <Checkbox id="resend" checked={resendTickets} onCheckedChange={(v) => setResendTickets(!!v)} />
              <div className="grid gap-0.5">
                <Label htmlFor="resend" className="cursor-pointer">Email the updated ticket pack to {registration.email}</Label>
                <p className="text-xs text-muted-foreground">
                  Sends every currently active ticket as a fresh PDF. Cancelled ticket numbers stop scanning at the door either way.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm whitespace-pre-line">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save amendment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
