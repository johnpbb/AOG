"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Save,
  Loader2,
  CheckCircle,
  Send,
  Eye,
  EyeOff,
  RotateCcw,
  Copy,
  ChevronDown,
  ChevronUp,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  TEMPLATE_META,
  TEMPLATE_NAMES,
  TemplateName,
  EmailTemplateContent,
} from "@/lib/email-defaults";

// Dynamically import the editor to avoid SSR issues with ProseMirror
const RichTextEditor = dynamic(
  () => import("./rich-text-editor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="h-24 rounded-lg border border-border animate-pulse bg-secondary" /> }
);

interface TemplateRow {
  id: string;
  subject: string;
  preHeading: string;
  heading: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  closingHtml: string;
  updatedAt: string;
}

const TEMPLATE_LABELS: Record<TemplateName, string> = {
  pending_registration: "Registration Received",
  admin_notification: "Admin Notification",
  ticket_confirmation: "Ticket Confirmation",
  confirmation_pdf: "Online Payment",
};

export function EmailTemplatesPanel() {
  const [activeTemplate, setActiveTemplate] = useState<TemplateName>("pending_registration");
  const [templates, setTemplates] = useState<Record<string, TemplateRow>>({});
  const [form, setForm] = useState<EmailTemplateContent>({
    subject: "",
    preHeading: "",
    heading: "",
    bodyHtml: "",
    ctaText: "",
    ctaUrl: "",
    closingHtml: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showVars, setShowVars] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [showTestSend, setShowTestSend] = useState(false);
  const [resetting, setResetting] = useState(false);
  const copiedRef = useRef<string | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Load all templates once
  useEffect(() => {
    fetch("/api/admin/email-templates")
      .then((r) => r.json())
      .then((rows: TemplateRow[]) => {
        const map: Record<string, TemplateRow> = {};
        rows.forEach((r) => (map[r.id] = r));
        setTemplates(map);
        const t = map["pending_registration"];
        if (t) setForm(rowToForm(t));
      })
      .catch(() => setError("Failed to load templates"))
      .finally(() => setLoading(false));
  }, []);

  function rowToForm(row: TemplateRow): EmailTemplateContent {
    return {
      subject: row.subject,
      preHeading: row.preHeading,
      heading: row.heading,
      bodyHtml: row.bodyHtml,
      ctaText: row.ctaText,
      ctaUrl: row.ctaUrl,
      closingHtml: row.closingHtml,
    };
  }

  function switchTemplate(name: TemplateName) {
    setActiveTemplate(name);
    setPreviewHtml(null);
    setShowPreview(false);
    setSaved(false);
    setError(null);
    const t = templates[name];
    if (t) setForm(rowToForm(t));
  }

  function updateField<K extends keyof EmailTemplateContent>(key: K, value: EmailTemplateContent[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/email-templates/${activeTemplate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const updated: TemplateRow = await res.json();
      setTemplates((prev) => ({ ...prev, [activeTemplate]: updated }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm("Reset this template to its default content? Your edits will be lost.")) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${activeTemplate}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const reset: TemplateRow = await res.json();
      setTemplates((prev) => ({ ...prev, [activeTemplate]: reset }));
      setForm(rowToForm(reset));
      setPreviewHtml(null);
    } catch {
      setError("Failed to reset template.");
    } finally {
      setResetting(false);
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${activeTemplate}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject);
      setShowPreview(true);
    } catch {
      setError("Failed to generate preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleTestSend() {
    if (!testEmail) return;
    setTestSending(true);
    setTestSent(false);
    try {
      const res = await fetch(`/api/admin/email-templates/${activeTemplate}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: form, recipientEmail: testEmail }),
      });
      if (!res.ok) throw new Error();
      setTestSent(true);
      setTimeout(() => setTestSent(false), 4000);
    } catch {
      setError("Failed to send test email.");
    } finally {
      setTestSending(false);
    }
  }

  const copyVar = useCallback((name: string) => {
    navigator.clipboard.writeText(`{{${name}}}`);
    setCopiedVar(name);
    copiedRef.current = name;
    setTimeout(() => {
      if (copiedRef.current === name) setCopiedVar(null);
    }, 1500);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading templates…
      </div>
    );
  }

  const meta = TEMPLATE_META[activeTemplate];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Email Templates</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Customise the emails sent to registrants and admins.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Template tabs */}
      <div className="flex flex-wrap gap-2">
        {TEMPLATE_NAMES.map((name) => (
          <button
            key={name}
            onClick={() => switchTemplate(name)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
              activeTemplate === name
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {TEMPLATE_LABELS[name]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_480px] gap-6 items-start">
        {/* Left: Editor */}
        <div className="space-y-5">
          {/* Template info */}
          <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">{meta.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
            </div>
          </div>

          {/* Subject */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <label className="block text-sm font-semibold text-foreground">Subject Line</label>
            <Input
              value={form.subject}
              onChange={(e) => updateField("subject", e.target.value)}
              placeholder="Email subject…"
            />
          </div>

          {/* Pre-heading & Heading */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                Tag / Label{" "}
                <span className="text-xs font-normal text-muted-foreground">(small orange uppercase text above heading)</span>
              </label>
              <Input
                value={form.preHeading}
                onChange={(e) => updateField("preHeading", e.target.value)}
                placeholder="e.g. Registration Received"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">Heading</label>
              <Input
                value={form.heading}
                onChange={(e) => updateField("heading", e.target.value)}
                placeholder="e.g. Hi {{registrantName}},"
              />
            </div>
          </div>

          {/* Body */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <label className="block text-sm font-semibold text-foreground">
              Body{" "}
              <span className="text-xs font-normal text-muted-foreground">(appears above the data table)</span>
            </label>
            <RichTextEditor
              value={form.bodyHtml}
              onChange={(html) => updateField("bodyHtml", html)}
              placeholder="Main email body text…"
              minHeight="100px"
            />
          </div>

          {/* CTA Button */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="text-sm font-semibold text-foreground">
              CTA Button{" "}
              <span className="text-xs font-normal text-muted-foreground">(leave blank to hide)</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Button Label</label>
                <Input
                  value={form.ctaText}
                  onChange={(e) => updateField("ctaText", e.target.value)}
                  placeholder="e.g. Go to Admin Dashboard →"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Button URL</label>
                <Input
                  value={form.ctaUrl}
                  onChange={(e) => updateField("ctaUrl", e.target.value)}
                  placeholder="e.g. https://… or {{adminUrl}}"
                />
              </div>
            </div>
            {form.ctaText && form.ctaUrl && (
              <div
                className="inline-block rounded-lg text-white text-sm font-bold px-5 py-3"
                style={{ background: "#FF6C00" }}
              >
                {form.ctaText}
              </div>
            )}
          </div>

          {/* Closing */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <label className="block text-sm font-semibold text-foreground">
              Closing Text{" "}
              <span className="text-xs font-normal text-muted-foreground">(appears after the data table)</span>
            </label>
            <RichTextEditor
              value={form.closingHtml}
              onChange={(html) => updateField("closingHtml", html)}
              placeholder="Closing message, instructions, or disclaimer…"
              minHeight="80px"
            />
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : (
                <><Save className="h-4 w-4" /> Save Template</>
              )}
            </Button>

            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <CheckCircle className="h-4 w-4" /> Saved
              </span>
            )}

            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={previewLoading}
              className="gap-2"
            >
              {previewLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
              ) : showPreview ? (
                <><EyeOff className="h-4 w-4" /> Hide Preview</>
              ) : (
                <><Eye className="h-4 w-4" /> Preview</>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowTestSend((v) => !v)}
              className="gap-2"
            >
              <Send className="h-4 w-4" /> Test Send
            </Button>

            <Button
              variant="ghost"
              onClick={handleReset}
              disabled={resetting}
              className="gap-2 text-muted-foreground ml-auto"
            >
              {resetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Reset to Default
            </Button>
          </div>

          {/* Test send inline panel */}
          {showTestSend && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <p className="text-sm font-semibold text-foreground">Send a Test Email</p>
              <p className="text-xs text-muted-foreground">
                Sends the current (unsaved) template with sample data to the address below. Subject will be prefixed with [TEST].
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="recipient@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTestSend()}
                />
                <Button onClick={handleTestSend} disabled={testSending || !testEmail} className="gap-2 shrink-0">
                  {testSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </Button>
              </div>
              {testSent && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                  <CheckCircle className="h-4 w-4" /> Test email sent!
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Variables panel + Preview */}
        <div className="space-y-4">
          {/* Variables panel */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-foreground hover:bg-secondary/50 transition-colors"
              onClick={() => setShowVars((v) => !v)}
            >
              Available Variables
              {showVars ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showVars && (
              <div className="px-5 pb-4 space-y-2">
                <p className="text-xs text-muted-foreground pb-1">
                  Type these directly into any field or click to copy.
                </p>
                <div className="space-y-1.5">
                  {meta.variables.map((v) => (
                    <div key={v.name} className="flex items-center justify-between gap-2 group">
                      <div className="min-w-0">
                        <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono text-primary">
                          {`{{${v.name}}}`}
                        </code>
                        <span className="text-xs text-muted-foreground ml-2 truncate hidden sm:inline">
                          {v.description}
                        </span>
                      </div>
                      <button
                        onClick={() => copyVar(v.name)}
                        title="Copy variable"
                        className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100"
                      >
                        {copiedVar === v.name ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                  Data tables (registration info, bank details, ticket QR codes) are always auto-inserted and cannot be removed.
                </p>
              </div>
            )}
          </div>

          {/* Preview pane */}
          {showPreview && previewHtml && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 bg-card border-b border-border">
                <p className="text-xs text-muted-foreground">Subject preview:</p>
                <p className="text-sm font-medium text-foreground truncate">{previewSubject}</p>
              </div>
              <iframe
                srcDoc={previewHtml}
                title="Email preview"
                className="w-full"
                style={{ height: "600px", border: "none", display: "block" }}
                sandbox="allow-same-origin"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
