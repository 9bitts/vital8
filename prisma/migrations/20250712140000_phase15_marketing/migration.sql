-- Fase 15 — Marketing e captação

CREATE TYPE "LeadStatus" AS ENUM ('NOVO', 'EM_CONTATO', 'AGENDOU', 'COMPARECEU', 'CONVERTIDO', 'PERDIDO');
CREATE TYPE "LeadInteractionType" AS ENUM ('LIGACAO', 'WHATSAPP', 'EMAIL', 'NOTA');
CREATE TYPE "ReferralRewardType" AS ENUM ('DESCONTO', 'CORTESIA');
CREATE TYPE "ReferralStatus" AS ENUM ('PENDENTE', 'AGENDOU', 'COMPARECEU', 'PREMIADA', 'REJEITADA');
CREATE TYPE "TestimonialStatus" AS ENUM ('SOLICITADO', 'RECEBIDO', 'APROVADO', 'PUBLICADO', 'REJEITADO');

ALTER TYPE "CommunicationOrigin" ADD VALUE IF NOT EXISTS 'LEAD_FOLLOWUP';
ALTER TYPE "AutomationTriggerEvent" ADD VALUE IF NOT EXISTS 'LEAD_NEW';
ALTER TYPE "AutomationTriggerEvent" ADD VALUE IF NOT EXISTS 'LEAD_NO_RESPONSE';
ALTER TYPE "AutomationTriggerEvent" ADD VALUE IF NOT EXISTS 'LEAD_NO_SHOW';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAD_STALE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAD_TASK';

ALTER TABLE "Patient" ADD COLUMN "utmSource" TEXT;
ALTER TABLE "Patient" ADD COLUMN "utmMedium" TEXT;
ALTER TABLE "Patient" ADD COLUMN "utmCampaign" TEXT;
ALTER TABLE "Patient" ADD COLUMN "utmTerm" TEXT;
ALTER TABLE "Patient" ADD COLUMN "utmContent" TEXT;
ALTER TABLE "Patient" ADD COLUMN "leadSourceId" TEXT;
ALTER TABLE "Patient" ADD COLUMN "marketingCampaignId" TEXT;
ALTER TABLE "Patient" ADD COLUMN "acquiredAt" TIMESTAMP(3);

CREATE TABLE "LeadSource" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leadSourceId" TEXT,
    "channel" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "investmentCents" INTEGER NOT NULL DEFAULT 0,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "fullName" TEXT NOT NULL,
    "phoneSearch" TEXT,
    "email" TEXT,
    "interestServiceId" TEXT,
    "leadSourceId" TEXT,
    "marketingCampaignId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NOVO',
    "lossReason" TEXT,
    "assignedUserId" TEXT,
    "marketingConsentAt" TIMESTAMP(3),
    "marketingConsentIp" TEXT,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "lastStatusAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadInteraction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "LeadInteractionType" NOT NULL,
    "notes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadInteraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadFollowUpLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "templateId" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "renderedBody" TEXT NOT NULL,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'FILA',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadFollowUpLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metaDescription" TEXT,
    "ogImageUrl" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "theme" JSONB NOT NULL DEFAULT '{}',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrackedLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "marketingCampaignId" TEXT,
    "targetUrl" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackedLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralProgram" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rewardType" "ReferralRewardType" NOT NULL DEFAULT 'DESCONTO',
    "rewardValue" TEXT NOT NULL,
    "maxPerPatientMonth" INTEGER NOT NULL DEFAULT 3,
    "terms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReferralProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "referrerPatientId" TEXT NOT NULL,
    "referredLeadId" TEXT,
    "referredPatientId" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDENTE',
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3),
    "consentIp" TEXT,
    "status" "TestimonialStatus" NOT NULL DEFAULT 'SOLICITADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadOptOut" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneSearch" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadOptOut_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadSource_organizationId_slug_key" ON "LeadSource"("organizationId", "slug");
CREATE INDEX "LeadSource_organizationId_idx" ON "LeadSource"("organizationId");

CREATE INDEX "MarketingCampaign_organizationId_idx" ON "MarketingCampaign"("organizationId");
CREATE INDEX "MarketingCampaign_leadSourceId_idx" ON "MarketingCampaign"("leadSourceId");

CREATE INDEX "Lead_organizationId_status_idx" ON "Lead"("organizationId", "status");
CREATE INDEX "Lead_organizationId_phoneSearch_idx" ON "Lead"("organizationId", "phoneSearch");
CREATE INDEX "Lead_leadSourceId_idx" ON "Lead"("leadSourceId");
CREATE INDEX "Lead_marketingCampaignId_idx" ON "Lead"("marketingCampaignId");
CREATE INDEX "Lead_patientId_idx" ON "Lead"("patientId");

CREATE INDEX "LeadInteraction_leadId_idx" ON "LeadInteraction"("leadId");
CREATE INDEX "LeadInteraction_organizationId_idx" ON "LeadInteraction"("organizationId");

CREATE UNIQUE INDEX "LeadFollowUpLog_idempotencyKey_key" ON "LeadFollowUpLog"("idempotencyKey");
CREATE INDEX "LeadFollowUpLog_organizationId_leadId_idx" ON "LeadFollowUpLog"("organizationId", "leadId");
CREATE INDEX "LeadFollowUpLog_status_scheduledFor_idx" ON "LeadFollowUpLog"("status", "scheduledFor");

CREATE UNIQUE INDEX "LandingPage_organizationId_slug_key" ON "LandingPage"("organizationId", "slug");
CREATE INDEX "LandingPage_organizationId_published_idx" ON "LandingPage"("organizationId", "published");

CREATE UNIQUE INDEX "TrackedLink_code_key" ON "TrackedLink"("code");
CREATE INDEX "TrackedLink_organizationId_idx" ON "TrackedLink"("organizationId");

CREATE UNIQUE INDEX "ReferralProgram_organizationId_key" ON "ReferralProgram"("organizationId");
CREATE INDEX "Referral_organizationId_idx" ON "Referral"("organizationId");
CREATE INDEX "Referral_referrerPatientId_idx" ON "Referral"("referrerPatientId");

CREATE INDEX "Testimonial_organizationId_status_idx" ON "Testimonial"("organizationId", "status");

CREATE INDEX "LeadOptOut_organizationId_phoneSearch_idx" ON "LeadOptOut"("organizationId", "phoneSearch");
CREATE INDEX "LeadOptOut_organizationId_email_idx" ON "LeadOptOut"("organizationId", "email");

ALTER TABLE "LeadSource" ADD CONSTRAINT "LeadSource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "LeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "LeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_marketingCampaignId_fkey" FOREIGN KEY ("marketingCampaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadInteraction" ADD CONSTRAINT "LeadInteraction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadInteraction" ADD CONSTRAINT "LeadInteraction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadInteraction" ADD CONSTRAINT "LeadInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeadFollowUpLog" ADD CONSTRAINT "LeadFollowUpLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadFollowUpLog" ADD CONSTRAINT "LeadFollowUpLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_marketingCampaignId_fkey" FOREIGN KEY ("marketingCampaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReferralProgram" ADD CONSTRAINT "ReferralProgram_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Referral" ADD CONSTRAINT "Referral_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerPatientId_fkey" FOREIGN KEY ("referrerPatientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredLeadId_fkey" FOREIGN KEY ("referredLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredPatientId_fkey" FOREIGN KEY ("referredPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadOptOut" ADD CONSTRAINT "LeadOptOut_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Patient" ADD CONSTRAINT "Patient_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "LeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_marketingCampaignId_fkey" FOREIGN KEY ("marketingCampaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
