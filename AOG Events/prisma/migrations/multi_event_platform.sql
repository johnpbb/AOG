-- Migration: multi-event-platform
-- This script migrates the schema to support multiple events.
-- Existing Registration and Venue data is linked to a "legacy" placeholder event.

-- 1. Create EventStatus enum
DO $$ BEGIN
  CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Create the Event table
CREATE TABLE IF NOT EXISTS "Event" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "shortDesc"   TEXT,
  "startDate"   TIMESTAMP(3),
  "endDate"     TIMESTAMP(3),
  "status"      "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "bannerUrl"   TEXT,
  "location"    TEXT,
  "slug"        TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Event_slug_key" ON "Event"("slug");
CREATE INDEX IF NOT EXISTS "Event_slug_idx" ON "Event"("slug");
CREATE INDEX IF NOT EXISTS "Event_status_idx" ON "Event"("status");

-- 3. Insert the legacy/placeholder event for existing data
INSERT INTO "Event" ("id", "name", "shortDesc", "description", "slug", "status", "location", "createdAt", "updatedAt")
VALUES (
  'legacy-aog-100',
  'AOG Fiji 100th Anniversary Celebration',
  'A historic gathering of faith, unity, and praise.',
  'Join us in celebrating 100 years of the Assemblies of God in Fiji.',
  'aog-100th-anniversary',
  'DRAFT',
  'Suva, Fiji',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

-- 4. Add eventId column to Venue (nullable for now)
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "eventId" TEXT;

-- 5. Add new columns to Venue (description, address, city, isActive, updatedAt)
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 6. Remove old Venue.id constraint type (it was TEXT @id already, no change needed)
-- Update existing venues to link to the legacy event
UPDATE "Venue" SET "eventId" = 'legacy-aog-100' WHERE "eventId" IS NULL;

-- 7. Now make eventId NOT NULL on Venue
ALTER TABLE "Venue" ALTER COLUMN "eventId" SET NOT NULL;

-- 8. Add FK constraint on Venue.eventId
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 9. Add eventId column to Registration (nullable first)
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "eventId" TEXT;

-- 10. Update existing registrations to link to the legacy event
UPDATE "Registration" SET "eventId" = 'legacy-aog-100' WHERE "eventId" IS NULL;

-- 11. Now make it NOT NULL
ALTER TABLE "Registration" ALTER COLUMN "eventId" SET NOT NULL;

-- 12. Change venueId FK: drop old constraint if exists, re-add pointing to cuid Venue
-- (The old Venue.id was plain TEXT @id, new one is cuid, so FK stays on venueId → Venue.id)
-- Note: if old venueId FK existed, drop it
DO $$ BEGIN
  ALTER TABLE "Registration" DROP CONSTRAINT IF EXISTS "Registration_venueId_fkey";
EXCEPTION WHEN undefined_object THEN null;
END $$;

-- 13. Add FK for Registration.eventId
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id")
  ON UPDATE CASCADE;

-- 14. Add index on Registration.eventId
CREATE INDEX IF NOT EXISTS "Registration_eventId_idx" ON "Registration"("eventId");
CREATE INDEX IF NOT EXISTS "Registration_venueId_idx" ON "Registration"("venueId");

-- 15. Re-add venueId FK (may have been dropped above)
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "Venue"("id")
  ON UPDATE CASCADE;
