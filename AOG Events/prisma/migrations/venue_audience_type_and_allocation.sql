-- Migration: venue audience-type + per-registration venue allocation
-- Supersedes an earlier "venue category" column (added but never populated)
-- — the client's venues turned out to be organized by attendee age group
-- (adults/youth/kids), not by church-size category, so a single registration
-- can now split across multiple venues instead of booking into just one.
-- This is provisional pending final client confirmation of the venue model.
-- Safe to run whether or not the earlier "category" column was ever applied.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Venue' AND column_name = 'category'
  ) THEN
    ALTER TABLE "Venue" RENAME COLUMN "category" TO "audienceType";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Venue' AND column_name = 'audienceType'
  ) THEN
    ALTER TABLE "Venue" ADD COLUMN "audienceType" TEXT;
  END IF;
END $$;

-- Registration.venueId is no longer always set — a registration's headcount
-- may now be split across several venues via VenueAllocation instead.
ALTER TABLE "Registration" ALTER COLUMN "venueId" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "VenueAllocation" (
  "id" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "audienceType" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueAllocation_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "VenueAllocation"
    ADD CONSTRAINT "VenueAllocation_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "Registration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "VenueAllocation"
    ADD CONSTRAINT "VenueAllocation_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "VenueAllocation_registrationId_audienceType_key"
  ON "VenueAllocation" ("registrationId", "audienceType");

CREATE INDEX IF NOT EXISTS "VenueAllocation_venueId_idx" ON "VenueAllocation" ("venueId");
