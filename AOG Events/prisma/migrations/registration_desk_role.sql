-- Migration: Registration Desk staff role
-- Adds a staff role limited to viewing registrations, registering people and
-- amending registrations (enforced in middleware.ts via lib/roles.ts).
-- Apply to production BEFORE deploying code that can assign this role.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'REGISTRATION';
