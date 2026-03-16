"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MapPin, Users, AlertTriangle, Lock, Unlock, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const mockVenues = [
  {
    id: "main-arena",
    name: "Main Arena",
    capacity: 10000,
    registered: 7234,
    checkedIn: 0,
    isLocked: false,
    location: "Suva City",
  },
  {
    id: "conference-hall",
    name: "Conference Hall",
    capacity: 5000,
    registered: 4500,
    checkedIn: 0,
    isLocked: false,
    location: "Suva City",
  },
  {
    id: "overflow-venue",
    name: "Overflow Venue",
    capacity: 6000,
    registered: 3500,
    checkedIn: 0,
    isLocked: false,
    location: "Nausori",
  },
];

export function VenueManagement() {
  const totalCapacity = mockVenues.reduce((sum, v) => sum + v.capacity, 0);
  const totalRegistered = mockVenues.reduce((sum, v) => sum + v.registered, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Venue Management</h1>
        <p className="text-muted-foreground">
          Monitor and manage venue capacity across all locations.
        </p>
      </div>

      {/* Overall Capacity */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Overall Capacity
              </h3>
              <p className="text-sm text-muted-foreground">
                {totalRegistered.toLocaleString()} of {totalCapacity.toLocaleString()} seats filled
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-foreground">
                {Math.round((totalRegistered / totalCapacity) * 100)}%
              </span>
            </div>
          </div>
          <Progress value={(totalRegistered / totalCapacity) * 100} className="h-3" />
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {mockVenues.length}
              </div>
              <div className="text-sm text-muted-foreground">Active Venues</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {(totalCapacity - totalRegistered).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Seats Available</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {totalRegistered.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Registered</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Venues */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockVenues.map((venue) => {
          const percentage = (venue.registered / venue.capacity) * 100;
          const isNearCapacity = percentage >= 80;
          const isFull = percentage >= 100;

          return (
            <Card key={venue.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        isFull
                          ? "bg-red-100"
                          : isNearCapacity
                          ? "bg-yellow-100"
                          : "bg-green-100"
                      )}
                    >
                      <MapPin
                        className={cn(
                          "h-5 w-5",
                          isFull
                            ? "text-red-600"
                            : isNearCapacity
                            ? "text-yellow-600"
                            : "text-green-600"
                        )}
                      />
                    </div>
                    <div>
                      <CardTitle className="text-base">{venue.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{venue.location}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Capacity Usage</span>
                      <span className="font-medium text-foreground">
                        {Math.round(percentage)}%
                      </span>
                    </div>
                    <Progress
                      value={percentage}
                      className={cn(
                        "h-2",
                        isFull && "[&>div]:bg-red-500",
                        isNearCapacity && !isFull && "[&>div]:bg-yellow-500"
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-foreground">
                          {venue.registered.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Registered</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-foreground">
                          {(venue.capacity - venue.registered).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Available</div>
                      </div>
                    </div>
                  </div>

                  {isNearCapacity && !isFull && (
                    <div className="flex items-center gap-2 text-yellow-600 text-sm bg-yellow-50 p-2 rounded-lg">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Approaching capacity</span>
                    </div>
                  )}

                  {isFull && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded-lg">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Venue at capacity</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant={venue.isLocked ? "destructive" : "outline"}
                      size="sm"
                      className="flex-1 gap-2"
                    >
                      {venue.isLocked ? (
                        <>
                          <Unlock className="h-4 w-4" />
                          Unlock
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Lock Venue
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
