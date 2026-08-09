-- Migration: event schedule table
-- Adds a free-text field admins can paste a schedule table into (tab-separated,
-- e.g. copied straight from Excel/Google Sheets), rendered on the public event
-- page. See lib/schedule-table.ts.

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "scheduleTable" TEXT;
