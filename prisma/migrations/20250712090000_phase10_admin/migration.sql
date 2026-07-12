-- Phase 10: Branches, permissions, billing, onboarding

-- Enums
CREATE TYPE "SubscriptionPlan" AS ENUM ('BASICO', 'PRO', 'ENTERPRISE');
CREATE TYPE "SubscriptionCycle" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ATIVA', 'INADIMPLENTE', 'CANCELADA');
CREATE TYPE "OrganizationExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED');

-- Branch
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB NOT NULL DEFAULT '{}',
    "cnes" TEXT,
    "documentNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Branch_organizationId_idx" ON "Branch"("organizationId");
CREATE INDEX "Branch_isActive_idx" ON "Branch"("isActive");
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- branchId columns
ALTER TABLE "Room" ADD COLUMN "branchId" TEXT;
ALTER TABLE "ScheduleTemplate" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "branchId" TEXT;
ALTER TABLE "CashRegister" ADD COLUMN "branchId" TEXT;
ALTER TABLE "TissGuide" ADD COLUMN "branchId" TEXT;
ALTER TABLE "TissBatch" ADD COLUMN "branchId" TEXT;
ALTER TABLE "StockLocation" ADD COLUMN "branchId" TEXT;

ALTER TABLE "Room" ADD CONSTRAINT "Room_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleTemplate" ADD CONSTRAINT "ScheduleTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TissGuide" ADD CONSTRAINT "TissGuide_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TissBatch" ADD CONSTRAINT "TissBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Room_branchId_idx" ON "Room"("branchId");
CREATE INDEX "ScheduleTemplate_branchId_idx" ON "ScheduleTemplate"("branchId");
CREATE INDEX "Appointment_branchId_idx" ON "Appointment"("branchId");
CREATE INDEX "CashRegister_branchId_idx" ON "CashRegister"("branchId");
CREATE INDEX "TissGuide_branchId_idx" ON "TissGuide"("branchId");
CREATE INDEX "StockLocation_branchId_idx" ON "StockLocation"("branchId");

-- Backfill: Unidade Principal per org
INSERT INTO "Branch" ("id", "organizationId", "name", "isMain", "isActive", "updatedAt")
SELECT
  'branch-main-' || o."id",
  o."id",
  'Unidade Principal',
  true,
  true,
  NOW()
FROM "Organization" o
WHERE o."deletedAt" IS NULL;

UPDATE "Room" r SET "branchId" = 'branch-main-' || r."organizationId" WHERE r."branchId" IS NULL;
UPDATE "ScheduleTemplate" s SET "branchId" = 'branch-main-' || s."organizationId" WHERE s."branchId" IS NULL;
UPDATE "Appointment" a SET "branchId" = 'branch-main-' || a."organizationId" WHERE a."branchId" IS NULL;
UPDATE "CashRegister" c SET "branchId" = 'branch-main-' || c."organizationId" WHERE c."branchId" IS NULL;
UPDATE "TissGuide" g SET "branchId" = 'branch-main-' || g."organizationId" WHERE g."branchId" IS NULL;
UPDATE "TissBatch" b SET "branchId" = 'branch-main-' || b."organizationId" WHERE b."branchId" IS NULL;
UPDATE "StockLocation" sl SET "branchId" = 'branch-main-' || sl."organizationId" WHERE sl."branchId" IS NULL;

-- Permission profiles
CREATE TABLE "PermissionProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleTemplate" "Role",
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "limits" JSONB NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PermissionProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PermissionProfile_organizationId_name_key" ON "PermissionProfile"("organizationId", "name");
CREATE INDEX "PermissionProfile_organizationId_idx" ON "PermissionProfile"("organizationId");
ALTER TABLE "PermissionProfile" ADD CONSTRAINT "PermissionProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Membership" ADD COLUMN "permissionProfileId" TEXT;
ALTER TABLE "Membership" ADD COLUMN "branchAccessAll" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_permissionProfileId_fkey" FOREIGN KEY ("permissionProfileId") REFERENCES "PermissionProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Membership_permissionProfileId_idx" ON "Membership"("permissionProfileId");

CREATE TABLE "MembershipBranch" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    CONSTRAINT "MembershipBranch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MembershipBranch_membershipId_branchId_key" ON "MembershipBranch"("membershipId", "branchId");
CREATE INDEX "MembershipBranch_branchId_idx" ON "MembershipBranch"("branchId");
ALTER TABLE "MembershipBranch" ADD CONSTRAINT "MembershipBranch_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipBranch" ADD CONSTRAINT "MembershipBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Subscription
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'BASICO',
    "cycle" "SubscriptionCycle" NOT NULL DEFAULT 'MONTHLY',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "gracePeriodEndsAt" TIMESTAMP(3),
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "limits" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubscriptionInvoice_subscriptionId_idx" ON "SubscriptionInvoice"("subscriptionId");
CREATE INDEX "SubscriptionInvoice_status_idx" ON "SubscriptionInvoice"("status");
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill subscriptions from Organization.plan
INSERT INTO "Subscription" ("id", "organizationId", "plan", "status", "trialEndsAt", "updatedAt")
SELECT
  'sub-' || o."id",
  o."id",
  CASE o."plan"
    WHEN 'STARTER' THEN 'BASICO'::"SubscriptionPlan"
    WHEN 'PRO' THEN 'PRO'::"SubscriptionPlan"
    WHEN 'ENTERPRISE' THEN 'ENTERPRISE'::"SubscriptionPlan"
    ELSE 'BASICO'::"SubscriptionPlan"
  END,
  CASE WHEN o."plan" = 'TRIAL' THEN 'TRIAL'::"SubscriptionStatus" ELSE 'ATIVA'::"SubscriptionStatus" END,
  o."trialEndsAt",
  NOW()
FROM "Organization" o
WHERE o."deletedAt" IS NULL;

CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OnboardingProgress_organizationId_key" ON "OnboardingProgress"("organizationId");
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OrganizationExport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "OrganizationExportStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT,
    "downloadToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "OrganizationExport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationExport_downloadToken_key" ON "OrganizationExport"("downloadToken");
CREATE INDEX "OrganizationExport_organizationId_idx" ON "OrganizationExport"("organizationId");
CREATE INDEX "OrganizationExport_status_idx" ON "OrganizationExport"("status");
ALTER TABLE "OrganizationExport" ADD CONSTRAINT "OrganizationExport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Composite indexes for high-volume queries
CREATE INDEX IF NOT EXISTS "Appointment_organizationId_branchId_startsAt_idx" ON "Appointment"("organizationId", "branchId", "startsAt");
CREATE INDEX IF NOT EXISTS "Appointment_organizationId_status_startsAt_idx" ON "Appointment"("organizationId", "status", "startsAt");
