-- Migration: spam/no-show auto-release for pending registrations
-- Adds a timestamp marking when the day-4 "expiring soon" warning email was
-- sent, so the daily expiry cron (app/api/cron/expire-registrations) doesn't
-- re-send it before day 5, when the registration is auto-cancelled.

ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "expiryReminderSentAt" TIMESTAMP(3);
