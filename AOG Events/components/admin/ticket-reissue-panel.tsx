"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Send, Square, RotateCcw, X } from "lucide-react";
import { format } from "date-fns";

interface ReissueRow {
  id: string;
  registrationId: string;
  name: string;
  email: string;
  emailUsable: boolean;
  activeTickets: number;
  ticketEmail: {
    lastAttemptAt: string;
    lastStatus: "sent" | "failed";
    lastError?: string | null;
    lastSentAt?: string | null;
  } | null;
}

type RunResult =
  | { status: "sent"; to: string; ticketCount: number }
  | { status: "skipped"; reason: string }
  | { status: "failed"; to?: string; ticketCount?: number; error: string };

type Scope = "all" | "unsent";

// Pause between registrations. Keeps a 100+ message run well inside Gmail's
// sending rate, and the per-call request means no single HTTP request runs
// long enough to hit a proxy timeout.
const DELAY_MS = 1500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Bulk "reissue tickets to every paid registrant" — added for the client's
// request to re-send all ticket packs once late registrations and payments
// are in. Each registration is one call to the per-registration resend
// endpoint; results are recorded server-side too (formData.ticketEmail).
export function TicketReissuePanel({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<ReissueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [running, setRunning] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [current, setCurrent] = useState<string | null>(null);
  const stopRef = useRef(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/tickets/reissue");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to load paid registrations");
      setRows(await res.json());
    } catch (err: any) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Closing or reloading the tab mid-run stops the loop, so warn first.
  useEffect(() => {
    if (!running) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [running]);

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const sendable = rows.filter((r) => r.emailUsable && r.activeTickets > 0);
  const noEmail = rows.filter((r) => !r.emailUsable);
  const neverSent = sendable.filter((r) => !r.ticketEmail?.lastSentAt);
  const lastFailed = sendable.filter((r) => r.ticketEmail?.lastStatus === "failed");
  const targets = scope === "all" ? sendable : sendable.filter((r) => !r.ticketEmail?.lastSentAt || r.ticketEmail.lastStatus === "failed");
  const totalTickets = targets.reduce((s, r) => s + r.activeTickets, 0);

  const done = queue.filter((id) => results[id]).length;
  const counts = Object.values(results).reduce(
    (acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }),
    { sent: 0, failed: 0, skipped: 0 } as Record<RunResult["status"], number>
  );
  const problems = queue.filter((id) => results[id] && results[id].status !== "sent");

  async function run(ids: string[]) {
    if (ids.length === 0) return;
    stopRef.current = false;
    setRunning(true);
    setQueue(ids);
    setResults((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      return next;
    });

    for (let i = 0; i < ids.length; i++) {
      if (stopRef.current) break;
      const id = ids[i];
      setCurrent(id);
      let result: RunResult;
      try {
        const res = await fetch(`/api/admin/registrations/${id}/resend-tickets`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        result = res.ok ? data : { status: "failed", error: data.error || `HTTP ${res.status}` };
      } catch (err: any) {
        result = { status: "failed", error: err?.message || "Network error" };
      }
      setResults((prev) => ({ ...prev, [id]: result }));
      if (i < ids.length - 1 && !stopRef.current) await sleep(DELAY_MS);
    }

    setCurrent(null);
    setRunning(false);
    load();
  }

  function start() {
    const ok = window.confirm(
      `Email ticket packs to ${targets.length} paid registration(s) (${totalTickets.toLocaleString()} tickets in total)?\n\n` +
        `Each registrant receives their current active tickets as a PDF. Existing ticket numbers and QR codes stay the same.\n\n` +
        `Keep this tab open until it finishes — roughly ${Math.ceil((targets.length * (DELAY_MS + 2500)) / 60000)} minute(s).`
    );
    if (ok) run(targets.map((r) => r.id));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Reissue Tickets</CardTitle>
          <CardDescription>
            Email the current ticket pack to every fully paid registration. Ticket numbers and QR codes don&apos;t change, so
            tickets already sent keep working.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} disabled={running} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading && rows.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading paid registrations…
          </div>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Paid registrations" value={rows.length} />
              <Stat label="No ticket email on record" value={neverSent.length} hint="tracking starts with this update" />
              <Stat label="Last send failed" value={lastFailed.length} tone={lastFailed.length ? "warn" : undefined} />
              <Stat label="No valid email" value={noEmail.length} tone={noEmail.length ? "warn" : undefined} />
            </div>

            {!running && (
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="gap-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="scope-all" />
                  <Label htmlFor="scope-all" className="cursor-pointer font-normal">
                    All paid registrations with an email address ({sendable.length})
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="unsent" id="scope-unsent" />
                  <Label htmlFor="scope-unsent" className="cursor-pointer font-normal">
                    Only those never sent or whose last send failed (
                    {sendable.filter((r) => !r.ticketEmail?.lastSentAt || r.ticketEmail.lastStatus === "failed").length})
                  </Label>
                </div>
              </RadioGroup>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {running ? (
                <Button variant="outline" className="gap-2" onClick={() => (stopRef.current = true)}>
                  <Square className="h-4 w-4" /> Stop after current
                </Button>
              ) : (
                <Button className="gap-2" onClick={start} disabled={targets.length === 0}>
                  <Send className="h-4 w-4" /> Send to {targets.length} registration(s)
                </Button>
              )}
              {!running && problems.some((id) => results[id]?.status === "failed") && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => run(problems.filter((id) => results[id]?.status === "failed"))}
                >
                  <RotateCcw className="h-4 w-4" /> Retry {problems.filter((id) => results[id]?.status === "failed").length} failed
                </Button>
              )}
            </div>

            {queue.length > 0 && (
              <div className="space-y-2">
                <Progress value={(done / queue.length) * 100} />
                <p className="text-sm text-muted-foreground">
                  {done} of {queue.length} processed · {counts.sent} sent · {counts.failed} failed · {counts.skipped} skipped
                  {current && byId.get(current) ? ` · sending ${byId.get(current)!.registrationId}…` : ""}
                  {!running && done < queue.length ? " · stopped" : ""}
                </p>
              </div>
            )}

            {(problems.length > 0 || noEmail.length > 0) && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Registration</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Problem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {problems.map((id) => {
                      const r = byId.get(id);
                      const res = results[id]!;
                      return (
                        <TableRow key={id}>
                          <TableCell>
                            <div className="font-medium">{r?.registrationId}</div>
                            <div className="text-xs text-muted-foreground">{r?.name}</div>
                          </TableCell>
                          <TableCell className="text-sm">{r?.email}</TableCell>
                          <TableCell className={`text-sm ${res.status === "failed" ? "text-destructive" : "text-amber-600"}`}>
                            {res.status === "failed" ? res.error : res.status === "skipped" ? res.reason : ""}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {noEmail
                      .filter((r) => !problems.includes(r.id))
                      .map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-medium">{r.registrationId}</div>
                            <div className="text-xs text-muted-foreground">{r.name}</div>
                          </TableCell>
                          <TableCell className="text-sm">{r.email || "—"}</TableCell>
                          <TableCell className="text-sm text-amber-600">
                            No valid email address — fix it via Amend, or hand these tickets over in person.
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!running && lastFailed.length > 0 && queue.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Most recent failure: {lastFailed[0].registrationId}
                {lastFailed[0].ticketEmail?.lastAttemptAt
                  ? ` (${format(new Date(lastFailed[0].ticketEmail.lastAttemptAt), "d MMM, h:mm a")})`
                  : ""}{" "}
                — {lastFailed[0].ticketEmail?.lastError}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: "warn" }) {
  return (
    <div className="rounded-md border p-3">
      <div className={`text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-amber-600" : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">
        {label}
        {hint ? <span className="block">{hint}</span> : null}
      </div>
    </div>
  );
}
