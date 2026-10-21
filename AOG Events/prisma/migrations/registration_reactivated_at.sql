-- Migration: reactivating cancelled registrations
-- Adds a timestamp set when a cancelled registration is brought back, so the
-- 10-business-day expiry window (app/api/cron/expire-registrations) runs from
-- reactivation instead of createdAt and doesn't cancel it again straight away.
-- Apply to production BEFORE deploying code that reads this column.

ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "reactivatedAt" TIMESTAMP(3);
