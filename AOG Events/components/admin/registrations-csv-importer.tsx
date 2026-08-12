"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Download, X, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventOption {
  id: string;
  name: string;
}

interface ValidatedRow {
  rowNumber: number;
  raw: Record<string, string>;
  errors: string[];
  input: unknown | null;
}

interface CommitResult {
  rowNumber: number;
  success: boolean;
  registrationId?: string;
  error?: string;
}

interface RegistrationsCsvImporterProps {
  onImported: () => void;
  onClose: () => void;
}

export function RegistrationsCsvImporter({ onImported, onClose }: RegistrationsCsvImporterProps) {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validating, setValidating] = useState(false);
  const [rows, setRows] = useState<ValidatedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitResults, setCommitResults] = useState<CommitResult[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/events?all=true")
      .then((r) => r.json())
      .then((data) => {
        const opts = (Array.isArray(data) ? data : []).map((e: any) => ({ id: e.id, name: e.name }));
        setEvents(opts);
        if (opts.length > 0) setEventId(opts[0].id);
      })
      .catch(() => {});
  }, []);

  const validCount = rows?.filter((r) => r.errors.length === 0).length ?? 0;
  const invalidCount = rows ? rows.length - validCount : 0;

  const handleFile = async (f: File) => {
    setFile(f);
    setError(null);
    setRows(null);
    setCommitResults(null);
    if (!eventId) {
      setError("Select an event first.");
      return;
    }

    setValidating(true);
    const form = new FormData();
    form.append("file", f);
    form.append("eventId", eventId);
    try {
      const res = await fetch("/api/admin/registrations/import/validate", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Validation failed.");
      setRows(body.rows);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!rows) return;
    const validRows = rows.filter((r) => r.errors.length === 0 && r.input);
    if (validRows.length === 0) return;

    setCommitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/registrations/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows.map((r) => ({ rowNumber: r.rowNumber, input: r.input })) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Import failed.");
      setCommitResults(body.results);
      if (body.succeeded > 0) onImported();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Import Registrations from CSV/Excel</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            {error}
          </div>
        )}

        {!commitResults && (
          <>
            <div className="flex items-center gap-3">
              <label htmlFor="import-event" className="text-sm text-muted-foreground shrink-0">Event</label>
              <select
                id="import-event"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm flex-1"
              >
                {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <a href="/api/admin/registrations/import/template" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline shrink-0">
                <Download className="h-3.5 w-3.5" /> Download template
              </a>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-foreground font-medium">{file ? file.name : "Drop a CSV or Excel file here, or click to choose"}</p>
              <p className="text-xs text-muted-foreground mt-1">Matches the columns in the downloadable template</p>
              <input ref={inputRef} type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            {validating && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Validating…
              </div>
            )}

            {rows && (
              <>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-green-700"><CheckCircle2 className="h-4 w-4" /> {validCount} ready to import</span>
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1.5 text-destructive"><AlertCircle className="h-4 w-4" /> {invalidCount} with errors (won&apos;t be imported)</span>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto border border-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Row</th>
                        <th className="text-left p-2 font-medium">Contact Email</th>
                        <th className="text-left p-2 font-medium">Type</th>
                        <th className="text-left p-2 font-medium">Category</th>
                        <th className="text-left p-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.rowNumber} className={cn("border-t border-border", r.errors.length > 0 && "bg-destructive/5")}>
                          <td className="p-2 text-muted-foreground">{r.rowNumber}</td>
                          <td className="p-2">{r.raw["Contact Email"]}</td>
                          <td className="p-2 capitalize">{r.raw["Type"]}</td>
                          <td className="p-2">{r.raw["Category"]}</td>
                          <td className="p-2">
                            {r.errors.length === 0 ? (
                              <span className="text-green-700">Ready</span>
                            ) : (
                              <span className="text-destructive">{r.errors.join("; ")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Button onClick={handleCommit} disabled={validCount === 0 || committing} className="w-full">
                  {committing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</> : `Import ${validCount} Registration${validCount === 1 ? "" : "s"}`}
                </Button>
              </>
            )}
          </>
        )}

        {commitResults && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
              {commitResults.filter((r) => r.success).length} registration(s) imported successfully.
              {commitResults.some((r) => !r.success) && ` ${commitResults.filter((r) => !r.success).length} row(s) failed.`}
            </div>
            {commitResults.some((r) => !r.success) && (
              <div className="max-h-60 overflow-y-auto border border-border rounded-lg text-sm">
                {commitResults.filter((r) => !r.success).map((r) => (
                  <div key={r.rowNumber} className="p-2 border-t border-border first:border-t-0">
                    <span className="text-muted-foreground">Row {r.rowNumber}:</span> <span className="text-destructive">{r.error}</span>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={onClose} className="w-full">Done</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
