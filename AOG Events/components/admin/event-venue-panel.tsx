"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Pencil, Trash2, Loader2, X, Check, Link, Unlink,
  MapPin, Users, Building2, ToggleLeft, ToggleRight, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Venue {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  capacity: number;
  currentRegistrations: number;
  isActive: boolean;
  eventId: string | null;
}

const emptyVenueForm = { name: "", description: "", address: "", city: "", capacity: "" };

type PanelMode = "list" | "create" | "edit" | "assign";

interface Props { eventId: string; }

export function EventVenuePanel({ eventId }: Props) {
  const [venues, setVenues] = useState<Venue[]>([]);          // venues for this event
  const [available, setAvailable] = useState<Venue[]>([]);    // unassigned venues
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PanelMode>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyVenueForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchVenues = useCallback(async () => {
    setLoading(true);
    try {
      const [assignedRes, availableRes] = await Promise.all([
        fetch(`/api/venues?eventId=${eventId}`),
        fetch(`/api/venues?unassigned=true`),
      ]);
      if (assignedRes.ok) setVenues(await assignedRes.json());
      if (availableRes.ok) setAvailable(await availableRes.json());
    } finally { setLoading(false); }
  }, [eventId]);

  useEffect(() => { fetchVenues(); }, [fetchVenues]);

  // --- Save (create or edit) ---
  const handleSave = async () => {
    if (!form.name || !form.capacity) { setError("Name and capacity are required."); return; }
    setError(null); setSaving(true);
    try {
      const payload = {
        name: form.name, description: form.description || null,
        address: form.address || null, city: form.city || null,
        capacity: parseInt(form.capacity),
        ...(mode === "create" && { eventId }), // new venues go straight into this event
      };
      const res = editingId
        ? await fetch(`/api/venues/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/venues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { resetForm(); fetchVenues(); }
      else { const d = await res.json(); setError(d.error || "Failed to save."); }
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  };

  const handleEdit = (v: Venue) => {
    setEditingId(v.id);
    setForm({ name: v.name, description: v.description || "", address: v.address || "", city: v.city || "", capacity: String(v.capacity) });
    setMode("edit"); setError(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove and delete venue "${name}"?`)) return;
    setDeletingId(id);
    const res = await fetch(`/api/venues/${id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json(); alert(d.error || "Failed to delete."); }
    else fetchVenues();
    setDeletingId(null);
  };

  const handleToggle = async (v: Venue) => {
    setTogglingId(v.id);
    await fetch(`/api/venues/${v.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !v.isActive }) });
    fetchVenues(); setTogglingId(null);
  };

  // Assign an unassigned venue to this event
  const handleAssign = async (venueId: string) => {
    setAssigningId(venueId);
    await fetch(`/api/venues/${venueId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId }) });
    fetchVenues(); setAssigningId(null);
  };

  // Remove a venue from this event (set eventId = null)
  const handleUnassign = async (venueId: string, name: string) => {
    if (!confirm(`Remove "${name}" from this event? The venue will remain in the system.`)) return;
    setUnassigningId(venueId);
    await fetch(`/api/venues/${venueId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: null }) });
    fetchVenues(); setUnassigningId(null);
  };

  const resetForm = () => { setMode("list"); setEditingId(null); setForm(emptyVenueForm); setError(null); };

  const inlineForm = (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <p className="text-xs font-semibold text-foreground">{mode === "edit" ? "Edit Venue" : "New Venue"}</p>
      {error && <p className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Venue Name *</Label>
          <Input className="h-8 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Main Arena" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Capacity *</Label>
          <Input className="h-8 text-sm" type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="5000" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">City</Label>
          <Input className="h-8 text-sm" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Suva" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Address</Label>
          <Input className="h-8 text-sm" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Victoria Parade" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Description</Label>
          <Input className="h-8 text-sm" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description or notes" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 h-7 text-xs">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {mode === "edit" ? "Save" : "Create & Add"}
        </Button>
        <Button size="sm" variant="ghost" onClick={resetForm} className="gap-1.5 h-7 text-xs">
          <X className="h-3 w-3" /> Cancel
        </Button>
      </div>
    </div>
  );

  const assignPicker = (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Assign Existing Venue</p>
        <button onClick={() => setMode("list")} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      {available.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No unassigned venues available. Create a new venue first from the <strong>Venues</strong> section, or create one directly below.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {available.map(v => (
            <div key={v.id} className="flex items-center justify-between bg-card rounded-md px-3 py-2 border border-border">
              <div>
                <span className="text-sm font-medium text-foreground">{v.name}</span>
                {v.city && <span className="text-xs text-muted-foreground ml-2">· {v.city}</span>}
                <span className="text-xs text-muted-foreground ml-2">· cap. {v.capacity.toLocaleString()}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleAssign(v.id)} disabled={assigningId === v.id} className="h-6 text-xs gap-1">
                {assigningId === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link className="h-3 w-3" />}
                Assign
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Venues</span>
          {!loading && <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full">{venues.length}</span>}
        </div>
        {mode === "list" && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setMode("assign"); setError(null); }} className="gap-1.5 h-7 text-xs">
              <Link className="h-3.5 w-3.5" /> Assign Existing
            </Button>
            <Button size="sm" onClick={() => { setMode("create"); setEditingId(null); setForm(emptyVenueForm); setError(null); }} className="gap-1.5 h-7 text-xs">
              <Plus className="h-3.5 w-3.5" /> Create New
            </Button>
          </div>
        )}
      </div>

      {/* Forms */}
      {(mode === "create" || mode === "edit") && inlineForm}
      {mode === "assign" && assignPicker}

      {/* Venue list */}
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : venues.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No venues for this event yet.</p>
          <p className="text-xs text-muted-foreground mt-0.5">Create a new venue or assign an existing one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {venues.map(v => {
            const pct = v.capacity > 0 ? Math.round((v.currentRegistrations / v.capacity) * 100) : 0;
            const near = pct >= 80; const full = pct >= 100;
            return (
              <div key={v.id} className={cn("rounded-lg border bg-card p-3 space-y-2", !v.isActive && "opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">{v.name}</span>
                      {!v.isActive && <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">Inactive</span>}
                      {full && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Full</span>}
                      {near && !full && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Near cap.</span>}
                    </div>
                    {v.city && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" />{v.city}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleToggle(v)} title={v.isActive ? "Deactivate" : "Activate"} className="p-1 rounded hover:bg-secondary" disabled={togglingId === v.id}>
                      {togglingId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : v.isActive ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <button onClick={() => handleEdit(v)} className="p-1 rounded hover:bg-secondary"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    <button onClick={() => handleUnassign(v.id, v.name)} disabled={unassigningId === v.id} title="Remove from event" className="p-1 rounded hover:bg-secondary">
                      {unassigningId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    <button onClick={() => handleDelete(v.id, v.name)} disabled={deletingId === v.id} className="p-1 rounded hover:bg-destructive/10">
                      {deletingId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{v.currentRegistrations}/{v.capacity}</span>
                    <span>{pct}%</span>
                  </div>
                  <Progress value={pct} className={cn("h-1.5", full && "[&>div]:bg-red-500", near && !full && "[&>div]:bg-yellow-500", !near && "[&>div]:bg-green-500")} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
