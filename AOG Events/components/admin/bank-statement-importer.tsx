"use client";

import { useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Upload, CheckCircle2, AlertCircle } from "lucide-react";

type MatchStatus = "match" | "partial" | "over" | "settled" | "duplicate" | "ambiguous" | "unmatched";

interface Line {
  rowNumber: number;
  date: string;
  amount: number;
  narration: string;
  fingerprint: string;
  status: MatchStatus;
  registration: { id: string; registrationId: string; label: string | null; fee: number; remaining: number } | null;
  candidates?: string[];
  note?: string;
}

interface Columns { date: string | null; credit: string | null; debit: string | null }

const STATUS_LABEL: Record<MatchStatus, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  match: { text: "Exact match", variant: "default" },
  partial: { text: "Partial", variant: "secondary" },
  over: { text: "Overpaid", variant: "secondary" },
  settled: { text: "Already paid", variant: "outline" },
  duplicate: { text: "Already imported", variant: "outline" },
  ambiguous: { text: "Ambiguous", variant: "destructive" },
  unmatched: { text: "No RegID found", variant: "destructive" },
};

const CHUNK = 10; // rows per confirm request — each paid row may email ticket PDFs
const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function BankStatementImporter({ open, onOpenChange, onImported }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [method, setMethod] = useState<"BANK_TRANSFER" | "MPAISA">("BANK_TRANSFER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columns, setColumns] = useState<Columns | null>(null);
  const [skippedDebits, setSkippedDebits] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<{ ok: number; completed: number; failed: { id: string; error: string }[] } | null>(null);

  function reset() {
    setFile(null); setLines(null); setError(null); setHeaders([]); setColumns(null);
    setSelected(new Set()); setProgress(null); setOutcome(null); setSkippedDebits(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function scan(f: File, cols?: Columns | null) {
    setLoading(true); setError(null);
    const body = new FormData();
    body.append("file", f);
    if (cols?.date) body.append("dateColumn", cols.date);
    if (cols?.credit) body.append("creditColumn", cols.credit);
    if (cols?.debit) body.append("debitColumn", cols.debit);
    try {
      const res = await fetch("/api/admin/bank-import/preview", { method: "POST", body });
      const data = await res.json();
      setHeaders(data.headers ?? []);
      setColumns(data.columns ?? null);
      if (!res.ok) { setError(data.error ?? "Couldn't read that file"); setLines(null); return; }
      setLines(data.lines);
      setSkippedDebits(data.skippedDebits ?? 0);
      // Only exact matches are ticked for the admin; everything else is opt-in.
      setSelected(new Set((data.lines as Line[]).filter((l) => l.status === "match").map((l) => l.fingerprint)));
    } catch {
      setError("Couldn't read that file"); setLines(null);
    } finally {
      setLoading(false);
    }
  }

  const importable = (l: Line) => !!l.registration && (l.status === "match" || l.status === "partial" || l.status === "over");
  const toggle = (fp: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(fp) ? next.delete(fp) : next.add(fp);
    return next;
  });

  const chosen = (lines ?? []).filter((l) => selected.has(l.fingerprint) && importable(l));
  const chosenTotal = chosen.reduce((s, l) => s + l.amount, 0);
  const exactCount = (lines ?? []).filter((l) => l.status === "match").length;

  async function confirm() {
    setProgress({ done: 0, total: chosen.length });
    let ok = 0, completed = 0;
    const failed: { id: string; error: string }[] = [];
    for (let i = 0; i < chosen.length; i += CHUNK) {
      const batch = chosen.slice(i, i + CHUNK);
      try {
        const res = await fetch("/api/admin/bank-import/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method,
            items: batch.map((l) => ({
              registrationId: l.registration!.id, amount: l.amount, fingerprint: l.fingerprint,
              date: l.date, narration: l.narration,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Request failed");
        for (const r of data.results) {
          if (r.ok) { ok++; if (r.fullyPaid) completed++; }
          else failed.push({ id: r.registrationId ?? r.fingerprint, error: r.error });
        }
      } catch (e: any) {
        batch.forEach((l) => failed.push({ id: l.registration!.registrationId, error: e.message }));
      }
      setProgress({ done: Math.min(i + CHUNK, chosen.length), total: chosen.length });
    }
    setProgress(null);
    setOutcome({ ok, completed, failed });
    if (ok > 0) onImported();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Bank Statement</DialogTitle>
          <DialogDescription>
            Upload the Westpac CSV/Excel export or an M-PAiSA statement. Credits are matched to registrations by the
            AG100 reference in the narration. Nothing is recorded until you confirm.
          </DialogDescription>
        </DialogHeader>

        {outcome ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-border p-4">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">{outcome.ok} payment{outcome.ok === 1 ? "" : "s"} recorded.</p>
                <p className="text-muted-foreground">
                  {outcome.completed} registration{outcome.completed === 1 ? "" : "s"} fully paid — tickets emailed.
                </p>
              </div>
            </div>
            {outcome.failed.length > 0 && (
              <div className="rounded-lg border border-destructive/40 p-4 text-sm space-y-1">
                <p className="font-medium flex items-center gap-2"><AlertCircle className="h-4 w-4 text-destructive" />{outcome.failed.length} row{outcome.failed.length === 1 ? "" : "s"} not recorded</p>
                {outcome.failed.map((f, i) => <p key={i} className="text-muted-foreground font-mono">{f.id}: {f.error}</p>)}
              </div>
            )}
            <Button onClick={() => { onOpenChange(false); reset(); }}>Done</Button>
          </div>
        ) : !lines ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">Bank transfer (Westpac)</SelectItem>
                  <SelectItem value="MPAISA">M-PAiSA</SelectItem>
                </SelectContent>
              </Select>
              <input
                ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); scan(f); } }}
              />
              <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {file ? file.name : "Choose statement file"}
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {headers.length > 0 && file && (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-sm text-muted-foreground">Tell us which column holds the money received:</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={columns?.credit ?? ""} onValueChange={(v) => setColumns({ date: columns?.date ?? null, debit: columns?.debit ?? null, credit: v })}>
                    <SelectTrigger className="w-56"><SelectValue placeholder="Credit / Amount column" /></SelectTrigger>
                    <SelectContent>
                      {headers.filter(Boolean).map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button disabled={!columns?.credit || loading} onClick={() => scan(file, columns)}>Re-scan</Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-muted-foreground">
                {lines.length} credit{lines.length === 1 ? "" : "s"} in <span className="font-medium text-foreground">{file?.name}</span>
                {skippedDebits > 0 && <> · {skippedDebits} debit{skippedDebits === 1 ? "" : "s"} ignored</>}
                {" · "}{exactCount} exact match{exactCount === 1 ? "" : "es"} pre-ticked
              </p>
              <Button variant="ghost" size="sm" onClick={reset}>Choose a different file</Button>
            </div>

            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Narration</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead className="text-right">Owing</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No credits found in this file.</TableCell></TableRow>
                  )}
                  {lines.map((l) => (
                    <TableRow key={l.fingerprint} className={l.status === "match" ? "" : "bg-muted/20"}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(l.fingerprint)}
                          disabled={!importable(l)}
                          onCheckedChange={() => toggle(l.fingerprint)}
                          aria-label={`Select row ${l.rowNumber}`}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{l.date}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-sm" title={l.narration}>{l.narration}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{money(l.amount)}</TableCell>
                      <TableCell className="text-sm">
                        {l.registration ? (
                          <><span className="font-mono">{l.registration.registrationId}</span>
                            {l.registration.label && <span className="block text-xs text-muted-foreground">{l.registration.label}</span>}</>
                        ) : l.candidates ? <span className="font-mono text-xs">{l.candidates.join(", ")}</span> : "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{l.registration ? money(l.registration.remaining) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_LABEL[l.status].variant}>{STATUS_LABEL[l.status].text}</Badge>
                        {l.note && <span className="block text-xs text-muted-foreground mt-1">{l.note}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {chosen.length} selected · {money(chosenTotal)}. Partial and overpaid rows are unticked — tick them only after checking.
              </p>
              <Button onClick={confirm} disabled={chosen.length === 0 || !!progress}>
                {progress
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Recording {progress.done}/{progress.total}…</>
                  : `Confirm ${chosen.length} payment${chosen.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
