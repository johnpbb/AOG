"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { AttendeeCountStepper } from "@/components/attendee-count-stepper";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";

interface LookupResult {
  registrationId: string;
  type: "CHURCH" | "INDIVIDUAL";
  categoryName: string;
  paymentStatus: string;
  headcountLocked: boolean;
  registrarName: string | null;
  pastorName: string | null;
  contactPreference: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  email: string;
  phone: string | null;
  adults: number;
  youth: number;
  kids: number;
  numberOfTickets: number;
  maxTicketsPerReg: number | null;
}

export default function ManageRegistrationPage() {
  const [registrationId, setRegistrationId] = useState("");
  const [contact, setContact] = useState("");
  const [lookupToken, setLookupToken] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [data, setData] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleLookup = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/register/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, contact, turnstileToken }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Lookup failed.");
      setLookupToken(body.token);
      setData(body.registration);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data || !lookupToken) return;
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        token: lookupToken,
        registrarName: data.registrarName,
        pastorName: data.pastorName,
        contactPreference: data.contactPreference,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        email: data.email,
        phone: data.phone,
      };
      if (!data.headcountLocked) {
        if (data.type === "CHURCH") {
          payload.adults = data.adults;
          payload.youth = data.youth;
          payload.kids = data.kids;
        } else {
          payload.numberOfTickets = data.numberOfTickets;
        }
      }

      const res = await fetch("/api/register/amend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not save changes.");
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="font-semibold text-foreground">AGFJ100</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-foreground">Manage Your Registration</h1>
        <p className="text-muted-foreground mt-1">
          Look up your registration to update your details or attendee numbers.
        </p>

        {error && (
          <div role="alert" className="mt-6 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            {error}
          </div>
        )}

        {!data ? (
          <div className="mt-8 space-y-6 p-6 rounded-lg border border-border bg-card">
            <FieldGroup className="space-y-4">
              <Field>
                <FieldLabel htmlFor="registrationId">Registration Code</FieldLabel>
                <p className="text-xs text-muted-foreground mb-1">e.g. AG100-027VL301 — from your confirmation email.</p>
                <Input id="registrationId" placeholder="AG100-..." value={registrationId}
                  onChange={(e) => setRegistrationId(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact">Email or Phone Number</FieldLabel>
                <p className="text-xs text-muted-foreground mb-1">Whichever you gave us when you registered.</p>
                <Input id="contact" placeholder="email@example.com or +679 XXX XXXX" value={contact}
                  onChange={(e) => setContact(e.target.value)} />
              </Field>
            </FieldGroup>

            <div className="flex justify-center">
              <TurnstileWidget onVerify={setTurnstileToken} />
            </div>

            <Button
              onClick={handleLookup}
              disabled={!registrationId || !contact || !turnstileToken || loading}
              className="w-full"
            >
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Looking up…</> : "Find My Registration"}
            </Button>
          </div>
        ) : saved ? (
          <div className="mt-8 p-6 rounded-lg border border-border bg-card text-center space-y-3">
            <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Changes saved</h2>
            <p className="text-muted-foreground text-sm">
              Registration {data.registrationId} has been updated.
            </p>
            <Link href="/" className="inline-flex items-center gap-1.5 text-primary text-sm hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to home
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-6 p-6 rounded-lg border border-border bg-card">
            <div>
              <p className="text-xs text-muted-foreground">Registration Code</p>
              <p className="font-mono font-semibold text-foreground">{data.registrationId}</p>
              <p className="text-sm text-muted-foreground mt-1">{data.categoryName}</p>
            </div>

            {data.headcountLocked && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                This registration is already paid, so attendee numbers can&apos;t be changed here — contact the event team for adjustments. You can still update contact details below.
              </div>
            )}

            {data.type === "CHURCH" ? (
              <>
                <FieldGroup className="grid gap-6 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="registrarName">Registrar Name</FieldLabel>
                    <Input id="registrarName" value={data.registrarName ?? ""}
                      onChange={(e) => setData({ ...data, registrarName: e.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pastorName">Pastor / Leader Name</FieldLabel>
                    <Input id="pastorName" value={data.pastorName ?? ""}
                      onChange={(e) => setData({ ...data, pastorName: e.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="contactPhone">Phone Number</FieldLabel>
                    <Input id="contactPhone" type="tel" value={data.contactPhone ?? ""}
                      onChange={(e) => setData({ ...data, contactPhone: e.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="contactEmail">Email Address</FieldLabel>
                    <Input id="contactEmail" type="email" value={data.contactEmail ?? ""}
                      onChange={(e) => setData({ ...data, contactEmail: e.target.value })} />
                  </Field>
                </FieldGroup>

                <div className="p-5 rounded-xl border-2 border-border bg-secondary/30 space-y-3">
                  <FieldLabel>Attendance Demographics</FieldLabel>
                  <div className="grid gap-3 md:grid-cols-3">
                    <AttendeeCountStepper id="adults" label="Adults" value={data.adults} disabled={data.headcountLocked}
                      onChange={(v) => setData({ ...data, adults: v })} />
                    <AttendeeCountStepper id="youth" label="NextGen / Youth" value={data.youth} disabled={data.headcountLocked}
                      onChange={(v) => setData({ ...data, youth: v })} />
                    <AttendeeCountStepper id="kids" label="Kids" value={data.kids} disabled={data.headcountLocked}
                      onChange={(v) => setData({ ...data, kids: v })} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <FieldGroup className="grid gap-6 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="email">Email Address</FieldLabel>
                    <Input id="email" type="email" value={data.email}
                      onChange={(e) => setData({ ...data, email: e.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
                    <Input id="phone" type="tel" value={data.phone ?? ""}
                      onChange={(e) => setData({ ...data, phone: e.target.value })} />
                  </Field>
                </FieldGroup>

                <div className="p-5 rounded-xl border-2 border-border bg-secondary/30">
                  <AttendeeCountStepper id="numberOfTickets" label="Number of Tickets" value={data.numberOfTickets}
                    disabled={data.headcountLocked} onChange={(v) => setData({ ...data, numberOfTickets: v })} />
                </div>
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => { setData(null); setLookupToken(null); setSaved(false); }}>
                Back
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
