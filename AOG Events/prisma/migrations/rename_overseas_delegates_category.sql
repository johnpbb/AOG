-- Migration: rename "overseas-delegates" category to "overseas"
-- Client confirmed dropping "Delegates" from all Overseas-category wording.
-- The category id/code aren't user-facing, but we're still in the build
-- phase (test data only), so renaming now keeps the id in sync with the
-- new display name instead of carrying the old wording internally forever.
-- Also switches the reference-number category code from "OD" (our
-- provisional deviation) to "OS", matching the client's original spec.

UPDATE "Registration" SET category = 'overseas' WHERE category = 'overseas-delegates';
