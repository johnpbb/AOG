-- Migration: named attendees on tickets
-- Adds an age-category tag to Attendee (Adult/Youth only — kids stay
-- headcount-only, never named, never ticketed) and links each Ticket to the
-- specific Attendee it was issued for. attendeeId is nullable because the
-- admin bulk-CSV-importer and any pre-existing registrations have no
-- per-person names; those tickets keep falling back to printing the
-- registrant's name instead.

DO $$ BEGIN
  CREATE TYPE "AttendeeAgeCategory" AS ENUM ('ADULT', 'YOUTH');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Attendee" ADD COLUMN IF NOT EXISTS "ageCategory" "AttendeeAgeCategory" NOT NULL DEFAULT 'ADULT';

ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "attendeeId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_attendeeId_key" UNIQUE ("attendeeId");
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Ticket"
    ADD CONSTRAINT "Ticket_attendeeId_fkey"
    FOREIGN KEY ("attendeeId") REFERENCES "Attendee"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
