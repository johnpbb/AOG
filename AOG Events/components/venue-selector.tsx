"use client";

import { cn, getCapacityColor } from "@/lib/utils";
import { MapPin, Users, AlertCircle } from "lucide-react";

interface Venue {
  id: string;
  name: string;
  city?: string | null;
  capacity: number;
  currentRegistrations: number;
}

interface VenueSelectorProps {
  selectedVenue: string | null;
  onSelect: (venueId: string) => void;
  venues: Venue[];
}

export function VenueSelector({ selectedVenue, onSelect, venues }: VenueSelectorProps) {
  const getAvailability = (venue: Venue) => {
    const remaining = venue.capacity - venue.currentRegistrations;
    const usedPct = venue.capacity > 0 ? Math.round((venue.currentRegistrations / venue.capacity) * 100) : 100;
    const isFull = usedPct >= 100;
    return {
      status: isFull ? "full" : usedPct >= 80 ? "almost-full" : "available",
      color: isFull ? "text-red-600" : usedPct >= 80 ? "text-amber-600" : "text-muted-foreground",
      bg: getCapacityColor(usedPct),
      remaining,
      usedPct,
    };
  };

  if (venues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No venues available for this event.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <MapPin className="h-4 w-4" />
        <span>Select your preferred venue</span>
      </div>

      <div className="grid gap-3">
        {venues.map((venue) => {
          const availability = getAvailability(venue);
          const isFull = availability.status === "full";
          const { remaining } = availability;

          return (
            <button
              key={venue.id}
              onClick={() => !isFull && onSelect(venue.id)}
              disabled={isFull}
              className={cn(
                "w-full text-left p-4 rounded-lg border transition-all",
                isFull
                  ? "opacity-50 cursor-not-allowed border-border bg-muted"
                  : selectedVenue === venue.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-card hover:border-primary/50"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-foreground">{venue.name}</h4>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    {venue.city && <span>{venue.city}</span>}
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {remaining.toLocaleString()} seats available
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("text-sm font-medium", availability.color)}>
                    {isFull ? "Sold Out" : `${Math.round((remaining / venue.capacity) * 100)}% Available`}
                  </div>
                  <div className="mt-2 h-2 w-24 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={cn("h-full transition-all", availability.bg)}
                      style={{ width: `${(remaining / venue.capacity) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              {isFull && (
                <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>This venue has reached capacity</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
