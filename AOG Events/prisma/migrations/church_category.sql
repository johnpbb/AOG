-- Migration: church category (for auto-selecting the registration category)
-- Adds an optional HQ-reported size/category to Church, sourced from the
-- General Secretary's membership spreadsheet. Nullable and never enforced —
-- used only to pre-fill the category step at registration.

ALTER TABLE "Church" ADD COLUMN IF NOT EXISTS "category" TEXT;
