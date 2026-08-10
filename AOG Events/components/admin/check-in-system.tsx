"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  QrCode, Search, CheckCircle, XCircle, User,
  Clock, AlertCircle, Camera, Calendar, RefreshCw,
  LogOut, RefreshCcw, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type ActionType = "CHECK_IN" | "CHECK_OUT" | "RE_ENTRY";
type TicketType = "ADULT" | "YOUTH";

interface ScanResult {
  success: boolean;
  action?: ActionType;
  ticketNumber?: string;
  ticketType?: TicketType;
  registrationId: string;
  name: string;
  category: string;
  venue: string;
  message: string;
  alreadyCheckedIn?: boolean;
  isFlagged?: boolean;
}

interface AttendanceEvent {
  id: string;
  type: "CHECK_IN" | "CHECK_OUT";
  timestamp: string;
  isFlagged: boolean;
  flagReason?: string;
  ticket?: { ticketNumber: string; ticketType: TicketType; attendee?: { firstName: string; lastName: string } | null } | null;
  registration: {
    registrationId: string;
    category: string;
    attendees: { firstName: string; lastName: string }[];
  };
}

// The ticket's own linked attendee (if any) is the correct name for this
// specific scan — registration.attendees[0] is only a fallback for
// legacy/admin-imported tickets with no per-person name.
function eventAttendeeName(ev: AttendanceEvent): string {
  if (ev.ticket?.attendee) return `${ev.ticket.attendee.firstName} ${ev.ticket.attendee.lastName}`;
  if (ev.registration.attendees[0]) return `${ev.registration.attendees[0].firstName} ${ev.registration.attendees[0].lastName}`;
  return ev.registration.registrationId;
}

interface DailyStats {
  date: string;
  checkInsToday: number;
  checkOutsToday: number;
  currentlyInside: number;
  insideByType: { ADULT: number; YOUTH: number };
  totalTickets: number;
  totalRegistrations: number;
  events: AttendanceEvent[];
  flagged: AttendanceEvent[];
}

function TicketTypeBadge({ type }: { type?: TicketType }) {
  if (!type) return null;
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
      type === "ADULT" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700")}>
      {type}
    </span>
  );
}

const ACTION_CONFIG = {
  CHECK_IN:  { color: "border-green-500 bg-green-50",  icon: CheckCircle, iconColor: "text-green-600",  bg: "bg-green-100"  },
  CHECK_OUT: { color: "border-blue-500 bg-blue-50",    icon: LogOut,       iconColor: "text-blue-600",   bg: "bg-blue-100"   },
  RE_ENTRY:  { color: "border-amber-500 bg-amber-50",  icon: RefreshCcw,   iconColor: "text-amber-600",  bg: "bg-amber-100"  },
  ERROR:     { color: "border-red-500 bg-red-50",      icon: XCircle,      iconColor: "text-red-600",    bg: "bg-red-100"    },
};

export function CheckInSystem() {
  const [manualId, setManualId] = useState("");
  const [manualCheckoutId, setManualCheckoutId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const todayLabel = format(new Date(), "EEEE, d MMMM yyyy");

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/admin/check-in");
      if (res.ok) setStats(await res.json());
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // QR Scanner
  useEffect(() => {
    let html5QrCode: any = null;
    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        html5QrCode = new Html5Qrcode("qr-reader");
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text: string) => { setIsScanning(false); performScan(text); }
        );
      } catch {
        setIsScanning(false);
        setLastResult({ success: false, registrationId: "", name: "Scanner Error", category: "", venue: "",
          message: "Could not access camera. Ensure HTTPS and camera permissions are granted." });
      }
    };
    if (isScanning) startScanner();
    return () => { if (html5QrCode?.isScanning) html5QrCode.stop().catch(console.error); };
  }, [isScanning]);

  const performScan = async (id: string) => {
    try {
      const res = await fetch("/api/admin/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: id }),
      });
      const data = await res.json();
      setLastResult(data);
      if (data.success) fetchStats();
    } catch {
      setLastResult({ success: false, registrationId: id, name: "Error", category: "", venue: "",
        message: "Network error — check connection and try again." });
    }
  };

  const handleManualScan = () => {
    if (!manualId.trim()) return;
    performScan(manualId.trim());
    setManualId("");
  };

  const handleManualCheckout = async () => {
    if (!manualCheckoutId.trim()) return;
    try {
      const res = await fetch("/api/admin/check-in", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketNumber: manualCheckoutId.trim() }),
      });
      const data = await res.json();
      setLastResult({ ...data, action: "CHECK_OUT" });
      setManualCheckoutId("");
      fetchStats();
    } catch {
      setLastResult({ success: false, registrationId: "", name: "Error", category: "", venue: "",
        message: "Network error during manual checkout." });
    }
  };

  const handleResolveFlag = async (eventId: string) => {
    setResolvingId(eventId);
    await fetch(`/api/admin/check-in?eventId=${eventId}`, { method: "DELETE" });
    fetchStats();
    setResolvingId(null);
  };

  const getResultConfig = (result: ScanResult) => {
    if (!result.success) return ACTION_CONFIG.ERROR;
    return ACTION_CONFIG[result.action || "CHECK_IN"];
  };

  const pct = stats && stats.totalTickets > 0
    ? Math.round((stats.checkInsToday / stats.totalTickets) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Check-In / Check-Out</h1>
          <div className="flex items-center gap-2 mt-1 text-muted-foreground text-sm flex-wrap">
            <Calendar className="h-4 w-4" />
            <span>{todayLabel}</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              Resets daily at midnight (Fiji time)
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loadingStats} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", loadingStats && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-700">{stats?.checkInsToday ?? "—"}</div>
            <div className="text-xs text-green-600 font-medium mt-0.5">Checked In Today</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-700">{stats?.checkOutsToday ?? "—"}</div>
            <div className="text-xs text-blue-600 font-medium mt-0.5">Checked Out Today</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-purple-700">{stats?.currentlyInside ?? "—"}</div>
            <div className="text-xs text-purple-600 font-medium mt-0.5">Currently Inside</div>
            {stats && (stats.insideByType.ADULT > 0 || stats.insideByType.YOUTH > 0) && (
              <div className="text-[10px] text-purple-500 mt-0.5">
                {stats.insideByType.ADULT} Adult · {stats.insideByType.YOUTH} Youth
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-foreground">{pct}%</div>
            <div className="text-xs text-muted-foreground mt-0.5">Today's Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      {stats && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Today's check-in progress</span>
            <span>{stats.checkInsToday} / {stats.totalTickets} tickets</span>
          </div>
          <div className="h-3 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scanner Card */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Scanner
                <span className="ml-auto text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  Auto-detects IN / OUT
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isScanning ? (
                <div className="relative">
                  <div id="qr-reader" className="w-full overflow-hidden rounded-lg border-2 border-primary bg-black min-h-[280px]" />
                  <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded animate-pulse">● Camera Active</div>
                </div>
              ) : (
                <div className="aspect-square max-w-sm mx-auto rounded-lg border-2 border-dashed border-border bg-secondary/30 flex items-center justify-center">
                  <div className="text-center p-8">
                    <QrCode className="h-16 w-16 text-muted-foreground mx-auto" />
                    <p className="mt-4 text-sm text-muted-foreground">Click Start to begin scanning</p>
                  </div>
                </div>
              )}

              <Button onClick={() => setIsScanning(s => !s)} className={cn("w-full gap-2", isScanning && "bg-destructive hover:bg-destructive/90")}>
                {isScanning ? <><XCircle className="h-4 w-4" /> Stop</> : <><Camera className="h-4 w-4" /> Start Scanner</>}
              </Button>

              {/* Manual ticket entry */}
              <div className="pt-3 border-t border-border space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Manual Ticket Entry (check-in or check-out)</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="AOG-TKT-00001" value={manualId} onChange={e => setManualId(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && handleManualScan()} className="pl-9 font-mono" />
                  </div>
                  <Button onClick={handleManualScan}>Scan</Button>
                </div>
              </div>

              {/* Manual force checkout */}
              <div className="pt-3 border-t border-border space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  Admin Force Checkout
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LogOut className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="AOG-TKT-00001" value={manualCheckoutId} onChange={e => setManualCheckoutId(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && handleManualCheckout()} className="pl-9 font-mono" />
                  </div>
                  <Button variant="outline" onClick={handleManualCheckout} className="border-amber-300 text-amber-700 hover:bg-amber-50">Checkout</Button>
                </div>
                <p className="text-xs text-muted-foreground">Will be flagged if no check-in exists for today.</p>
              </div>
            </CardContent>
          </Card>

          {/* Last result */}
          {lastResult && (() => {
            const cfg = getResultConfig(lastResult);
            const Icon = cfg.icon;
            return (
              <Card className={cn("border-2 transition-all", cfg.color)}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={cn("p-3 rounded-full flex-shrink-0", cfg.bg)}>
                      <Icon className={cn("h-8 w-8", cfg.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={cn("text-base font-semibold", cfg.iconColor)}>{lastResult.message}</h3>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-foreground">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{lastResult.name}</span>
                          <TicketTypeBadge type={lastResult.ticketType} />
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {lastResult.ticketNumber || lastResult.registrationId}
                        </div>
                        {(lastResult.category || lastResult.venue) && (
                          <div className="text-xs text-muted-foreground capitalize">
                            {lastResult.category?.replace(/-/g, " ")}{lastResult.venue && ` · ${lastResult.venue}`}
                          </div>
                        )}
                        {lastResult.isFlagged && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                            <AlertTriangle className="h-3.5 w-3.5" /> Flagged anomaly — visible in admin panel
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>

        {/* Activity + Flagged */}
        <div className="space-y-4">
          {/* Today's activity feed */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Today's Activity
                {stats && (
                  <span className="ml-auto text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full font-normal">
                    {stats.events.length} events
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {!stats || stats.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No activity yet today</p>
                ) : (
                  stats.events.map(ev => {
                    const nameStr = eventAttendeeName(ev);
                    const timeStr = format(new Date(ev.timestamp), "HH:mm");
                    const isIn = ev.type === "CHECK_IN";
                    return (
                      <div key={ev.id} className={cn("flex items-center justify-between py-2 px-2 rounded-md text-sm",
                        ev.isFlagged ? "bg-amber-50" : isIn ? "bg-green-50/50" : "bg-blue-50/50"
                      )}>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
                            ev.isFlagged ? "bg-amber-100" : isIn ? "bg-green-100" : "bg-blue-100"
                          )}>
                            {ev.isFlagged
                              ? <AlertTriangle className="h-3 w-3 text-amber-600" />
                              : isIn
                              ? <CheckCircle className="h-3 w-3 text-green-600" />
                              : <LogOut className="h-3 w-3 text-blue-600" />}
                          </div>
                          <div>
                            <p className="font-medium text-foreground leading-tight flex items-center gap-1.5">
                              {nameStr}
                              <TicketTypeBadge type={ev.ticket?.ticketType} />
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {ev.ticket?.ticketNumber || ev.registration.registrationId}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={cn("text-xs font-semibold", isIn ? "text-green-700" : "text-blue-700")}>
                            {isIn ? "IN" : "OUT"}
                          </p>
                          <p className="text-xs text-muted-foreground">{timeStr}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Flagged anomalies */}
          {stats && stats.flagged.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  Flagged Anomalies
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-normal">
                    {stats.flagged.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stats.flagged.map(ev => {
                    const nameStr = eventAttendeeName(ev);
                    return (
                      <div key={ev.id} className="flex items-start justify-between gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                            {nameStr}
                            <TicketTypeBadge type={ev.ticket?.ticketType} />
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {ev.ticket?.ticketNumber || ev.registration.registrationId}
                          </p>
                          <p className="text-xs text-amber-700 mt-0.5">{ev.flagReason}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(ev.timestamp), "d MMM · HH:mm")}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleResolveFlag(ev.id)}
                          disabled={resolvingId === ev.id}
                          className="gap-1 h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 flex-shrink-0">
                          <ShieldCheck className="h-3 w-3" />
                          Resolve
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
