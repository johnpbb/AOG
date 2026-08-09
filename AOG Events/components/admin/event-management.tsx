"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BannerUploader } from "@/components/admin/banner-uploader";
import { EventVenuePanel } from "@/components/admin/event-venue-panel";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Globe,
  EyeOff,
  CheckCircle,
  XCircle,
  MapPin,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";

interface EventVenue {
  id: string;
  name: string;
  city: string | null;
  capacity: number;
  currentRegistrations: number;
}

interface Event {
  id: string;
  name: string;
  description: string | null;
  shortDesc: string | null;
  startDate: string | null;
  endDate: string | null;
  status: EventStatus;
  bannerUrl: string | null;
  location: string | null;
  slug: string;
  scheduleTable: string | null;
  venues: EventVenue[];
  _count: { registrations: number };
  createdAt: string;
}

const statusConfig: Record<EventStatus, { label: string; icon: React.ElementType; className: string }> = {
  DRAFT: { label: "Draft", icon: EyeOff, className: "bg-gray-100 text-gray-600" },
  PUBLISHED: { label: "Published", icon: Globe, className: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelled", icon: XCircle, className: "bg-red-100 text-red-700" },
  COMPLETED: { label: "Completed", icon: CheckCircle, className: "bg-blue-100 text-blue-700" },
};

const emptyForm = {
  name: "",
  shortDesc: "",
  description: "",
  slug: "",
  location: "",
  startDate: "",
  endDate: "",
  bannerUrl: "",
  status: "DRAFT" as EventStatus,
  scheduleTable: "",
};

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function EventManagement() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/events?all=true");
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleNameChange = (value: string) => {
    setForm((f) => ({
      ...f,
      name: value,
      slug: editingId ? f.slug : slugify(value),
    }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.slug) {
      setError("Name and slug are required.");
      return;
    }
    setError(null);
    setSaving(true);

    const payload = {
      name: form.name,
      shortDesc: form.shortDesc || null,
      description: form.description || null,
      slug: form.slug,
      location: form.location || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      bannerUrl: form.bannerUrl || null,
      status: form.status,
      scheduleTable: form.scheduleTable || null,
    };

    try {
      const res = editingId
        ? await fetch(`/api/events/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        if (!editingId) {
          // After creating, immediately open edit mode so venues can be added
          const created = await res.json();
          setEditingId(created.id);
          setForm(f => ({ ...f, slug: created.slug }));
          fetchEvents();
        } else {
          setShowForm(false);
          setEditingId(null);
          setForm(emptyForm);
          fetchEvents();
        }
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save event.");
      }
    } catch (e) {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (event: Event) => {
    setEditingId(event.id);
    setForm({
      name: event.name,
      shortDesc: event.shortDesc || "",
      description: event.description || "",
      slug: event.slug,
      location: event.location || "",
      startDate: event.startDate ? event.startDate.slice(0, 16) : "",
      endDate: event.endDate ? event.endDate.slice(0, 16) : "",
      bannerUrl: event.bannerUrl || "",
      status: event.status,
      scheduleTable: event.scheduleTable || "",
    });
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event? This will also delete all associated venues and registrations.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (res.ok) fetchEvents();
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Events</h1>
          <p className="text-muted-foreground">Create and manage AOG Fiji events.</p>
        </div>
        {!showForm && (
          <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); setError(null); }} className="gap-2">
            <Plus className="h-4 w-4" />
            New Event
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {editingId ? "Edit Event" : "Create New Event"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-name">Event Name *</Label>
                <Input
                  id="event-name"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="AOG Fiji 100th Anniversary"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-slug">URL Slug *</Label>
                <Input
                  id="event-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="aog-100th-anniversary"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-short-desc">Short Description</Label>
              <Input
                id="event-short-desc"
                value={form.shortDesc}
                onChange={(e) => setForm((f) => ({ ...f, shortDesc: e.target.value }))}
                placeholder="One-liner shown on event cards"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-desc">Full Description</Label>
              <RichTextEditor
                value={form.description}
                onChange={(html) => setForm((f) => ({ ...f, description: html }))}
                placeholder="Full event description..."
                minHeight="100px"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-start">Start Date & Time</Label>
                <Input
                  id="event-start"
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-end">End Date & Time</Label>
                <Input
                  id="event-end"
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-location">Location</Label>
                <Input
                  id="event-location"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Suva, Fiji"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-status">Status</Label>
                <select
                  id="event-status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EventStatus }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Banner Image</Label>
              <BannerUploader
                value={form.bannerUrl}
                onChange={(url) => setForm((f) => ({ ...f, bannerUrl: url }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-schedule">Event Schedule</Label>
              <p className="text-xs text-muted-foreground">
                Select your schedule table in Excel or Google Sheets, copy it, then click into the box below and
                paste — it'll show up on the event page laid out the same way. You can also build or edit a table
                directly using the table tool in the toolbar.
              </p>
              <RichTextEditor
                value={form.scheduleTable}
                onChange={(html) => setForm((f) => ({ ...f, scheduleTable: html }))}
                placeholder="Paste your schedule table here…"
                minHeight="140px"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSubmit} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Create Event & Add Venues"}
              </Button>
              <Button variant="outline" onClick={handleCancel} className="gap-2">
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>

            {/* Venue sub-panel — only visible when editing an existing event */}
            {editingId && (
              <div className="border-t border-border pt-5 mt-2">
                <EventVenuePanel eventId={editingId} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Events List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium text-foreground">No events yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first event to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const { label, icon: StatusIcon, className: statusClass } = statusConfig[event.status];
            const isExpanded = expandedId === event.id;

            return (
              <Card key={event.id} className="overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CalendarDays className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{event.name}</h3>
                        <span className={cn("hidden sm:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", statusClass)}>
                          <StatusIcon className="h-3 w-3" />
                          {label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
                        )}
                        {event.startDate && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {format(new Date(event.startDate), "d MMM yyyy")}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {event._count.registrations} registrations
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.venues.length} venues
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); handleEdit(event); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                      disabled={deletingId === event.id}
                    >
                      {deletingId === event.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border pt-4 space-y-3">
                    {event.shortDesc && (
                      <p className="text-sm text-muted-foreground">{event.shortDesc}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Slug: <code className="bg-secondary px-1 rounded">{event.slug}</code></span>
                      {event.endDate && (
                        <span>Ends: {format(new Date(event.endDate), "d MMM yyyy, HH:mm")}</span>
                      )}
                    </div>
                    {event.venues.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-2">Venues</p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {event.venues.map((v) => (
                            <div key={v.id} className="flex items-center justify-between bg-secondary/40 rounded-lg px-3 py-2 text-xs">
                              <span className="font-medium text-foreground">{v.name}</span>
                              <span className="text-muted-foreground">
                                {v.currentRegistrations}/{v.capacity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
