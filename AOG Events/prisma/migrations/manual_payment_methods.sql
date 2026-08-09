-- Migration: manual payment methods (Mpaisa, World Remit)
-- Online payment (ANZ eGate) is disabled for now — no merchant account yet.
-- Adds two new manual/offline PaymentMethod values and the SiteConfig fields
-- admins need to display Mpaisa/World Remit instructions to registrants,
-- mirroring the existing bank transfer fields.

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MPAISA';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'WORLD_REMIT';

ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "mpaisaNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "mpaisaName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "worldRemitInstructions" TEXT NOT NULL DEFAULT '';
