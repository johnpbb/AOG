-- Migration: allow more than one ticket per registration to check in per day
--
-- ticket_checkin.sql moved check-in from registration-level to ticket-level and
-- added UNIQUE(ticketId, checkInDate), but left the older
-- UNIQUE(registrationId, checkInDate) in place. The two are incompatible: the
-- check-in route upserts on (ticketId, checkInDate), so the SECOND ticket of a
-- registration scanned on the same day finds no matching row, attempts an
-- INSERT, and trips the registration-level unique instead.
--
-- Effect before this migration: exactly one attendee per church could be
-- scanned in per day — a 500-ticket church would admit one person and then
-- fail on everyone else, with the error surfacing at the door as an HTTP 500.
--
-- Legacy rows (ticketId IS NULL) are unaffected: Postgres treats NULLs as
-- distinct in a unique index, so they were never covered by the ticket-level
-- unique and are historical only — nothing writes ticketId = NULL any more.

DROP INDEX IF EXISTS "DailyCheckIn_registrationId_checkInDate_key";
