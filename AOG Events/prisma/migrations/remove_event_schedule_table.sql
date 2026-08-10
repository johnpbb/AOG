-- Migration: remove event schedule table
-- The pasted-schedule-table feature (see event_schedule_table.sql) has been
-- replaced by a hardcoded schedule tab component on the public event page,
-- since this app currently serves a single event. Revisit if/when the app
-- is repurposed for multi-event use.

ALTER TABLE "Event" DROP COLUMN IF EXISTS "scheduleTable";
