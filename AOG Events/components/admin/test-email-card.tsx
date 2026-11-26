"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";

type Result = { ok: true; to: string; from: string; ms: number } | { ok: false; to?: string; from?: string; error: string };

// Sends a sample "[TEST]" ticket pack through the live email account, so
// staff can confirm ticket emails work before a reissue run without
// emailing a real registrant. See app/api/admin/test-email.
export function TestEmailCard() {
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = await res.json().catch(() => ({}));
      setResult(res.ok ? data : { ok: false, error: data.error || `HTTP ${res.status}` });
    } catch (err: any) {
      setResult({ ok: false, error: err?.message || "Network error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Test Ticket Email</h3>
          <p className="text-xs text-muted-foreground">
            Sends a sample ticket pack marked &ldquo;[TEST]&rdquo;, with a PDF of two sample tickets, from the live email
            account. Nothing is saved and no registrant is emailed. The sample QR codes won&apos;t scan at check-in.
          </p>
        </div>
      </div>

      <Field>
        <FieldLabel htmlFor="testEmailTo">Send to</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="testEmailTo"
            type="email"
            placeholder="your.name@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && to.trim() && !sending) send();
            }}
          />
          <Button type="button" onClick={send} disabled={sending || !to.trim()} className="gap-2 shrink-0">
            {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Mail className="h-4 w-4" /> Send test</>}
          </Button>
        </div>
      </Field>

      {result?.ok === true && (
        <p className="flex items-start gap-1.5 text-sm text-green-600">
          <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Sent to {result.to} from {result.from} in {(result.ms / 1000).toFixed(1)}s. Check the inbox and the spam
            folder.
          </span>
        </p>
      )}
      {result?.ok === false && (
        <p className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Could not send{result.from ? ` from ${result.from}` : ""}: {result.error}
          </span>
        </p>
      )}
    </div>
  );
}
