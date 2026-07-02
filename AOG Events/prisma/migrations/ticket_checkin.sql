-- Migration: ticket-based check-in
-- Adds ticketId FK to DailyCheckIn and AttendanceEvent so check-in can be
-- scoped per-ticket instead of per-registration. Nullable, so existing rows
-- (ticketId = NULL) remain valid — there is no reliable 1:1 backfill mapping
-- since a registration may have had multiple tickets.

ALTER TABLE "DailyCheckIn" ADD COLUMN IF NOT EXISTS "ticketId" TEXT;
ALTER TABLE "AttendanceEvent" ADD COLUMN IF NOT EXISTS "ticketId" TEXT;

DO $$ BEGIN
  ALTER TABLE "DailyCheckIn"
    ADD CONSTRAINT "DailyCheckIn_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceEvent"
    ADD CONSTRAINT "AttendanceEvent_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "DailyCheckIn_ticketId_checkInDate_key"
  ON "DailyCheckIn" ("ticketId", "checkInDate");
