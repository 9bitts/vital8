-- Phase 16A: JWT session revocation via sessionVersion
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Membership" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
