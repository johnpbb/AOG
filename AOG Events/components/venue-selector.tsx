"use client";

import { cn } from "@/lib/utils";
import { VENUES, Venue } from "@/lib/types";
import { MapPin, Users, AlertCircle } from "lucide-react";

interface VenueSelectorProps {
  selectedVenue: string | null;
  onSelect: (venueId: string) => void;
}

export function VenueSelector({ selectedVenue, onSelect }: VenueSelectorProps) {
  const getAvailability = (venue: Venue) => {
    const remaining = venue.capacity - venue.currentRegistrations;
    const percentage = (remaining / venue.capacity) * 100;
    
    if (percentage > 50) return { status: "available", color: "text-green-600", bg: "bg-green-500" };
    if (percentage > 20) return { status: "limited", color: "text-yellow-600", bg: "bg-yellow-500" };
    if (percentage > 0) return { status: "almost-full", color: "text-orange-600", bg: "bg-orange-500" };
    return { status: "full", color: "text-red-600", bg: "bg-red-500" };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <MapPin className="h-4 w-4" />
        <span>Select your preferred venue</span>
      </div>

      <div className="grid gap-3">
        {VENUES.map((venue) => {
          const availability = getAvailability(venue);
          const isFull = availability.status === "full";
          const remaining = venue.capacity - venue.currentRegistrations;

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
