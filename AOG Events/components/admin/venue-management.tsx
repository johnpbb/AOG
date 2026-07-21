"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  MapPin, Users, AlertTriangle, Plus, Pencil, Trash2,
  Loader2, X, Building2, ToggleLeft, ToggleRight, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { YOUTH_AGE_RANGE, KIDS_AGE_RANGE } from "@/lib/types";

interface Venue {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  capacity: number;
  currentRegistrations: number;
  isActive: boolean;
  audienceType: string | null;
  eventId: string | null;
  event: { id: string; name: string; slug: string } | null;
  _count: { registrations: number };
}

const emptyForm = {
  name: "", description: "", address: "", city: "", capacity: "", isActive: true, audienceType: "",
};

// Provisional model: venues are dedicated to one age group, pending final
// client confirmation of how venue assignment should actually work.
const AUDIENCE_TYPES = [
  { id: "adults", name: "Adults" },
  { id: "youth", name: `NextGen / Youth (${YOUTH_AGE_RANGE})` },
  { id: "kids", name: `Kids (${KIDS_AGE_RANGE})` },
];

function audienceTypeName(id: string | null) {
  return AUDIENCE_TYPES.find((c) => c.id === id)?.name ?? null;
}

export function VenueManagement() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [filterAssigned, setFilterAssigned] = useState<"all" | "assigned" | "unassigned">("all");

  const fetchVenues = useCallback(async () => {
    setLoading(true);
    try {
      const param = filterAssigned === "assigned" ? "?eventId=" : filterAssigned === "unassigned" ? "?unassigned=true" : "";
      const res = await fetch(`/api/venues${param}`);
      if (res.ok) setVenues(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterAssigned]);

  useEffect(() => { fetchVenues(); }, [fetchVenues]);

  const handleSubmit = async () => {
    if (!form.name || !form.capacity) { setError("Name and capacity are required."); return; }
    setError(null); setSaving(true);
    const payload = {
      name: form.name, description: form.description || null,
      address: form.address || null, city: form.city || null,
      capacity: parseInt(form.capacity), isActive: form.isActive,
      audienceType: form.audienceType || null,
    };
    try {
      const res = editingId
        ? await fetch(`/api/venues/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/venues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { setShowForm(false); setEditingId(null); setForm(emptyForm); fetchVenues(); }
      else { const d = await res.json(); setError(d.error || "Failed to save venue."); }
    } catch { setError("Network error. Please try again."); }
    finally { setSaving(false); }
  };

  const handleEdit = (venue: Venue) => {
    setEditingId(venue.id);
    setForm({ name: venue.name, description: venue.description || "", address: venue.address || "", city: venue.city || "", capacity: String(venue.capacity), isActive: venue.isActive, audienceType: venue.audienceType || "" });
    setShowForm(true); setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeactivate = async (id: string) => {
    setDeletingId(id);
    const res = await fetch(`/api/venues/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error || "Failed to deactivate venue."); }
    else fetchVenues();
    setDeletingId(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete venue "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    const res = await fetch(`/api/venues/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      if (res.status === 409 && confirm(`${d.error}\n\nDeactivate it instead? It will stop being offered to new registrants but existing registrations are unaffected.`)) {
        await handleDeactivate(id);
        return;
      }
      alert(d.error || "Failed to delete venue.");
    }
    else fetchVenues();
    setDeletingId(null);
  };

  const handleCancel = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); setError(null); };

  const totalCapacity = venues.reduce((s, v) => s + v.capacity, 0);
  const totalRegistered = venues.reduce((s, v) => s + v.currentRegistrations, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Venues</h1>
          <p className="text-muted-foreground">
            Create and manage venues. Assign them to events from the <strong>Events</strong> section.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); setError(null); }} className="gap-2">
            <Plus className="h-4 w-4" /> Add Venue
          </Button>
        )}
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {editingId ? "Edit Venue" : "Add New Venue"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</div>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="venue-name">Venue Name *</Label>
                <Input id="venue-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Main Arena" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="venue-capacity">Capacity *</Label>
                <Input id="venue-capacity" type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="10000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="venue-city">City</Label>
                <Input id="venue-city" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Suva" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="venue-address">Address</Label>
                <Input id="venue-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Victoria Parade" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="venue-audience-type">Age Group</Label>
                <p className="text-xs text-muted-foreground -mt-0.5 mb-1">
                  Registrants' headcount for this age group is automatically booked into this venue. Leave unset to exclude it from automatic assignment. (Provisional — pending final confirmation of how venue assignment should work.)
                </p>
                <select
                  id="venue-audience-type"
                  value={form.audienceType}
                  onChange={e => setForm(f => ({ ...f, audienceType: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">No age group (excluded from auto-assignment)</option>
                  {AUDIENCE_TYPES.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="venue-description">Description</Label>
              <textarea
                id="venue-description" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Venue details, accessibility info, etc." rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))} className="flex items-center gap-2 text-sm text-foreground">
              {form.isActive ? <ToggleRight className="h-5 w-5 text-green-600" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
              {form.isActive ? "Active" : "Inactive"} (accepting registrations)
            </button>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSubmit} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Add Venue"}
              </Button>
              <Button variant="outline" onClick={handleCancel} className="gap-2"><X className="h-4 w-4" /> Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        {(["all", "assigned", "unassigned"] as const).map(f => (
          <button key={f} onClick={() => setFilterAssigned(f)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize",
              filterAssigned === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            )}>
            {f === "all" ? "All Venues" : f === "assigned" ? "Assigned to Event" : "Unassigned"}
          </button>
        ))}
      </div>

      {/* Summary */}
      {venues.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Overall Capacity</h3>
                <p className="text-sm text-muted-foreground">{totalRegistered.toLocaleString()} of {totalCapacity.toLocaleString()} seats filled</p>
              </div>
              <span className="text-3xl font-bold text-foreground">
                {totalCapacity > 0 ? Math.round((totalRegistered / totalCapacity) * 100) : 0}%
              </span>
            </div>
            <Progress value={totalCapacity > 0 ? (totalRegistered / totalCapacity) * 100 : 0} className="h-3" />
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div><div className="text-2xl font-bold">{venues.filter(v => v.isActive).length}</div><div className="text-sm text-muted-foreground">Active</div></div>
              <div><div className="text-2xl font-bold text-green-600">{(totalCapacity - totalRegistered).toLocaleString()}</div><div className="text-sm text-muted-foreground">Available</div></div>
              <div><div className="text-2xl font-bold">{venues.filter(v => !v.eventId).length}</div><div className="text-sm text-muted-foreground">Unassigned</div></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Venues Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : venues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium text-foreground">No venues{filterAssigned !== "all" ? ` (${filterAssigned})` : ""}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {filterAssigned === "unassigned" ? "All venues are assigned to events." : "Add your first venue to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {venues.map(venue => {
            const pct = venue.capacity > 0 ? (venue.currentRegistrations / venue.capacity) * 100 : 0;
            const near = pct >= 80; const full = pct >= 100;
            return (
              <Card key={venue.id} className={cn(!venue.isActive && "opacity-60")}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("p-2 rounded-lg", full ? "bg-red-100" : near ? "bg-yellow-100" : "bg-green-100")}>
                        <MapPin className={cn("h-5 w-5", full ? "text-red-600" : near ? "text-yellow-600" : "text-green-600")} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{venue.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{venue.city || "—"}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(venue)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(venue.id, venue.name)} disabled={deletingId === venue.id}>
                        {deletingId === venue.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-muted-foreground">Capacity</span>
                        <span className="font-medium">{Math.round(pct)}%</span>
                      </div>
                      <Progress value={pct} className={cn("h-2", full && "[&>div]:bg-red-500", near && !full && "[&>div]:bg-yellow-500")} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div><div className="font-medium">{venue.currentRegistrations.toLocaleString()}</div><div className="text-xs text-muted-foreground">Registered</div></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div><div className="font-medium">{(venue.capacity - venue.currentRegistrations).toLocaleString()}</div><div className="text-xs text-muted-foreground">Available</div></div>
                      </div>
                    </div>

                    {/* Event assignment badge */}
                    <div className={cn("flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md", venue.event ? "bg-blue-50 text-blue-700" : "bg-secondary text-muted-foreground")}>
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      {venue.event ? <span className="truncate font-medium">{venue.event.name}</span> : <span>Not assigned to any event</span>}
                    </div>

                    {/* Age-group badge — drives automatic venue assignment */}
                    <div className={cn("flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md", audienceTypeName(venue.audienceType) ? "bg-purple-50 text-purple-700" : "bg-amber-50 text-amber-700")}>
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      {audienceTypeName(venue.audienceType)
                        ? <span className="truncate font-medium">{audienceTypeName(venue.audienceType)}</span>
                        : <span>No age group — excluded from auto-assignment</span>}
                    </div>

                    {near && !full && <div className="flex items-center gap-2 text-yellow-600 text-sm bg-yellow-50 p-2 rounded-lg"><AlertTriangle className="h-4 w-4" /> Approaching capacity</div>}
                    {full && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded-lg"><AlertTriangle className="h-4 w-4" /> Venue at capacity</div>}

                    {venue._count.registrations > 0 && venue.isActive && (
                      <Button
                        variant="outline" size="sm" className="w-full gap-2"
                        onClick={() => handleDeactivate(venue.id)}
                        disabled={deletingId === venue.id}
                      >
                        {deletingId === venue.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                        Deactivate
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
