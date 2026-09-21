// Creates (or updates) the gala dinner Event and its ballroom Venue.
//
// The gala is sold as its own Event rather than as another category on the
// AGFJ100 conference registration, so it needs a row before the public
// booking page at /events/the-journey-gala-dinner/register will resolve.
//
// The Venue row is not optional: autoAssignVenues refuses to allocate a
// headcount bucket that has no matching active venue, and createRegistration
// turns that refusal into a hard failure — so without an "adults" venue on
// this event, every gala booking is rejected as "This session is full".
// That venue's `capacity` is also the real seat inventory: both gala
// categories allocate against it, so seats and tables draw down one shared
// pool and neither can oversell the room.
//
// Run with:  npx tsx prisma/seed-gala-event.ts
// Override the ballroom size with:  GALA_BALLROOM_CAPACITY=420 npx tsx prisma/seed-gala-event.ts
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { GALA_EVENT_SLUG, GALA_DETAILS } from "../lib/types";

// Placeholder until the client confirms the Golden Ballroom's seated
// capacity — an admin can change it any time under Venues without a redeploy.
const DEFAULT_CAPACITY = 500;

async function main() {
  const capacity = Math.max(1, parseInt(process.env.GALA_BALLROOM_CAPACITY ?? "", 10) || DEFAULT_CAPACITY);

  const description = `
    <p>Celebrating 100 years of God's faithfulness in the Assemblies of God, Fiji —
    honoring the past, embracing the present and sowing seeds for the future.</p>
    <p><strong>${GALA_DETAILS.dateLabel}</strong> · ${GALA_DETAILS.timeLabel}<br/>
    ${GALA_DETAILS.venueName}<br/>
    Dress code: ${GALA_DETAILS.dressCode}</p>
    <p>Tickets: <strong>$300 FJD per person</strong>, or <strong>$3,000 FJD for a table of 10</strong>.</p>
    <p>Enquiries: <a href="mailto:${GALA_DETAILS.enquiriesEmail}">${GALA_DETAILS.enquiriesEmail}</a>
    · ${GALA_DETAILS.enquiriesPhone}</p>
  `.trim();

  const eventData = {
    name: GALA_DETAILS.eventName,
    shortDesc: "An evening celebrating 100 years — $300 per person or $3,000 per table of 10.",
    description,
    // Fiji is UTC+12 in December (no DST), so these are 4pm–9pm local.
    startDate: new Date("2026-12-12T16:00:00+12:00"),
    endDate: new Date("2026-12-12T21:00:00+12:00"),
    location: "Sheraton Fiji Golf & Beach Resort, Denarau",
  };

  // `status` is deliberately absent from `update` and DRAFT on `create`:
  // seeding is content maintenance, not a decision to open ticket sales.
  // An earlier version published on every run, which silently reopened the
  // page after it had been taken down — and once put the gala live while the
  // gala code was still undeployed, so the URL served the conference form.
  // Going live is a deliberate act in Admin → Events.
  const event = await prisma.event.upsert({
    where: { slug: GALA_EVENT_SLUG },
    update: eventData,
    create: { ...eventData, slug: GALA_EVENT_SLUG, status: "DRAFT" },
  });

  // Keyed on name within this event so re-running never creates a second
  // ballroom — and `capacity` is deliberately left alone on update, so a
  // capacity the client has since corrected in admin isn't stomped back to
  // the default by a re-run.
  const existingVenue = await prisma.venue.findFirst({
    where: { eventId: event.id, name: GALA_DETAILS.venueName },
  });

  const venue = existingVenue
    ? await prisma.venue.update({
        where: { id: existingVenue.id },
        data: { audienceType: "adults", isActive: true, city: GALA_DETAILS.city },
      })
    : await prisma.venue.create({
        data: {
          name: GALA_DETAILS.venueName,
          city: GALA_DETAILS.city,
          address: "Denarau Island, Nadi, Fiji",
          capacity,
          // Everyone at the gala is seated and ticketed as an adult — this is
          // what makes autoAssignVenues route the whole booking here.
          audienceType: "adults",
          isActive: true,
          eventId: event.id,
        },
      });

  console.log(`Gala event ready: ${event.name}`);
  console.log(`  slug      /events/${event.slug}/register`);
  console.log(`  venue     ${venue.name}`);
  console.log(`  seats     ${venue.currentRegistrations} booked of ${venue.capacity}`);
  console.log(`  status    ${event.status}${event.status === "PUBLISHED" ? " — LIVE, taking bookings" : " — not public; publish in Admin -> Events when ready"}`);
  if (existingVenue) {
    console.log(`  (capacity left at its current value — change it under Admin → Venues)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
