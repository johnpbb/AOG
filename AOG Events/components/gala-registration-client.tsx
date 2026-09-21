"use client";

import { useState } from "react";
import { GalaBookingForm } from "@/components/gala-booking-form";
import { RegistrationSuccess } from "@/components/registration-success";

interface SerializedVenue {
  id: string;
  name: string;
  capacity: number;
  currentRegistrations: number;
  isActive: boolean;
}

interface Props {
  event: {
    id: string;
    name: string;
    venues: SerializedVenue[];
  };
}

/**
 * The gala's counterpart to EventRegistrationClient. Much shorter, because
 * the gala has no church path, no category picker and no named-attendee step:
 * it's one form and one confirmation screen.
 */
export function GalaRegistrationClient({ event }: Props) {
  const [booking, setBooking] = useState<{
    registrationId: string;
    email: string;
    fee: number;
    numberOfTickets: number;
  } | null>(null);

  // The ballroom is the "adults" venue on this event — the same row
  // autoAssignVenues allocates against, so its free seats are the real
  // remaining inventory shared by seat and table bookings alike. Null when no
  // venue is configured yet, in which case the form doesn't claim a number
  // (the server still rejects the booking).
  const ballroom = event.venues.find((v) => v.isActive) ?? null;
  const seatsRemaining = ballroom ? Math.max(0, ballroom.capacity - ballroom.currentRegistrations) : null;

  if (booking) {
    return (
      <RegistrationSuccess
        registrationId={booking.registrationId}
        email={booking.email}
        fee={booking.fee}
        numberOfTickets={booking.numberOfTickets}
        paymentMethod="bank-transfer"
        newRegistrationLabel="Book More Seats"
        onNewRegistration={() => setBooking(null)}
      />
    );
  }

  return (
    <GalaBookingForm
      eventId={event.id}
      seatsRemaining={seatsRemaining}
      onSubmit={(data) =>
        setBooking({
          registrationId: String(data.registrationId),
          email: String(data.email),
          fee: Number(data.fee),
          numberOfTickets: Number(data.numberOfTickets),
        })
      }
    />
  );
}
