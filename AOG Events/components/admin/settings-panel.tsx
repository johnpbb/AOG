"use client";

import { useEffect, useState } from "react";
import { Save, Building2, Bell, Loader2, CheckCircle, CalendarX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";

interface SiteConfig {
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranch: string;
  notificationEmail: string;
  // "YYYY-MM-DDTHH:mm" in Fiji time for the datetime-local input; "" = open.
  registrationClosesAt: string;
}

// Fiji is a fixed UTC+12 (no DST since 2022), so convert with a fixed offset
// rather than the admin's browser timezone.
const FIJI_OFFSET_MS = 12 * 60 * 60 * 1000;
function isoToFijiLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Date(d.getTime() + FIJI_OFFSET_MS).toISOString().slice(0, 16);
}
function fijiLocalToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(`${local}:00+12:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const empty: SiteConfig = {
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankBranch: "",
  notificationEmail: "",
  registrationClosesAt: "",
};

export function SettingsPanel() {
  const [config, setConfig] = useState<SiteConfig>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        setConfig({
          bankName: data.bankName ?? "",
          bankAccountName: data.bankAccountName ?? "",
          bankAccountNumber: data.bankAccountNumber ?? "",
          bankBranch: data.bankBranch ?? "",
          notificationEmail: data.notificationEmail ?? "",
          registrationClosesAt: isoToFijiLocal(data.registrationClosesAt),
        });
      })
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const update = (field: keyof SiteConfig, value: string) =>
    setConfig((prev) => ({ ...prev, [field]: value }));

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, registrationClosesAt: fijiLocalToIso(config.registrationClosesAt) }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Configure bank details and notification preferences. Online payment is disabled — Westpac Internet Bank
          Transfer is the only payment method, verified manually.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Bank Transfer Details */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Bank Transfer Details</h3>
            <p className="text-xs text-muted-foreground">Displayed to registrants on the payment pending screen and in emails.</p>
          </div>
        </div>

        <FieldGroup className="grid gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bankName">Bank Name</FieldLabel>
            <Input
              id="bankName"
              placeholder="e.g. Westpac"
              value={config.bankName}
              onChange={(e) => update("bankName", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="bankBranch">Branch / BSB (optional)</FieldLabel>
            <Input
              id="bankBranch"
              placeholder="e.g. Suva Main Branch"
              value={config.bankBranch}
              onChange={(e) => update("bankBranch", e.target.value)}
            />
          </Field>

          <Field className="md:col-span-2">
            <FieldLabel htmlFor="bankAccountName">Account Name</FieldLabel>
            <Input
              id="bankAccountName"
              placeholder="e.g. Assemblies of God Fiji"
              value={config.bankAccountName}
              onChange={(e) => update("bankAccountName", e.target.value)}
            />
          </Field>

          <Field className="md:col-span-2">
            <FieldLabel htmlFor="bankAccountNumber">Account Number</FieldLabel>
            <Input
              id="bankAccountNumber"
              placeholder="e.g. 1234-567890"
              value={config.bankAccountNumber}
              onChange={(e) => update("bankAccountNumber", e.target.value)}
            />
          </Field>
        </FieldGroup>
      </div>

      {/* Public registration close */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarX className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Public Registration Close</h3>
            <p className="text-xs text-muted-foreground">
              From this time the public conference form shows &ldquo;Registration closed&rdquo;. Staff who are logged in
              can still register people through the form or CSV import. Gala dinner bookings are not affected.
              Leave blank to keep registration open.
            </p>
          </div>
        </div>

        <Field>
          <FieldLabel htmlFor="registrationClosesAt">Closes at (Fiji time)</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="registrationClosesAt"
              type="datetime-local"
              value={config.registrationClosesAt}
              onChange={(e) => update("registrationClosesAt", e.target.value)}
            />
            {config.registrationClosesAt && (
              <Button type="button" variant="outline" onClick={() => update("registrationClosesAt", "")}>
                Clear
              </Button>
            )}
          </div>
        </Field>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Notifications</h3>
            <p className="text-xs text-muted-foreground">Where to send alerts when a new bank transfer registration is submitted.</p>
          </div>
        </div>

        <Field>
          <FieldLabel htmlFor="notificationEmail">Admin Notification Email</FieldLabel>
          <Input
            id="notificationEmail"
            type="email"
            placeholder="e.g. admin@example.com"
            value={config.notificationEmail}
            onChange={(e) => update("notificationEmail", e.target.value)}
          />
        </Field>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          ) : (
            <><Save className="h-4 w-4" /> Save Settings</>
          )}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <CheckCircle className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
