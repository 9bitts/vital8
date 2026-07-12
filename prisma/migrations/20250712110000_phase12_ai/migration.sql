-- Phase 12: Applied AI

CREATE TYPE "AiResourceType" AS ENUM ('VIRTUAL_SECRETARY', 'CLINICAL_COPILOT', 'SMART_COLLECTION', 'NO_SHOW_SCORING', 'BI_INSIGHTS', 'GLOSA_DRAFT', 'SMART_SEARCH');
CREATE TYPE "AiInteractionOutcome" AS ENUM ('PENDING', 'ACCEPTED', 'EDITED', 'REJECTED');
CREATE TYPE "AiConversationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'HANDOFF');
CREATE TYPE "AiConversationMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

CREATE TABLE "AiSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabledResources" JSONB NOT NULL DEFAULT '{}',
    "model" TEXT NOT NULL DEFAULT 'claude-3-5-sonnet-latest',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "silenceStartHour" INTEGER,
    "silenceEndHour" INTEGER,
    "monthlyTokenLimit" INTEGER NOT NULL DEFAULT 500000,
    "monthlyAlertSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiSettings_organizationId_key" ON "AiSettings"("organizationId");
ALTER TABLE "AiSettings" ADD CONSTRAINT "AiSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AiDataProcessingConsent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "resource" "AiResourceType" NOT NULL,
    "termVersion" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "AiDataProcessingConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiDataProcessingConsent_organizationId_resource_key" ON "AiDataProcessingConsent"("organizationId", "resource");
CREATE INDEX "AiDataProcessingConsent_organizationId_idx" ON "AiDataProcessingConsent"("organizationId");
ALTER TABLE "AiDataProcessingConsent" ADD CONSTRAINT "AiDataProcessingConsent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AiInteractionLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "resource" "AiResourceType" NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "outcome" "AiInteractionOutcome" NOT NULL DEFAULT 'PENDING',
    "payloadEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiInteractionLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiInteractionLog_organizationId_resource_createdAt_idx" ON "AiInteractionLog"("organizationId", "resource", "createdAt");
ALTER TABLE "AiInteractionLog" ADD CONSTRAINT "AiInteractionLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AiUsageMonthly" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiUsageMonthly_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiUsageMonthly_organizationId_yearMonth_key" ON "AiUsageMonthly"("organizationId", "yearMonth");
ALTER TABLE "AiUsageMonthly" ADD CONSTRAINT "AiUsageMonthly_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AiFaq" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiFaq_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiFaq_organizationId_isActive_idx" ON "AiFaq"("organizationId", "isActive");
ALTER TABLE "AiFaq" ADD CONSTRAINT "AiFaq_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "externalPhone" TEXT NOT NULL,
    "patientId" TEXT,
    "status" "AiConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastIntent" TEXT,
    "outcome" TEXT,
    "handoffContextEncrypted" TEXT,
    "sessionState" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiConversation_organizationId_externalPhone_idx" ON "AiConversation"("organizationId", "externalPhone");
CREATE INDEX "AiConversation_organizationId_status_idx" ON "AiConversation"("organizationId", "status");
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AiConversationMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AiConversationMessageRole" NOT NULL,
    "contentEncrypted" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiConversationMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiConversationMessage_conversationId_idx" ON "AiConversationMessage"("conversationId");
CREATE INDEX "AiConversationMessage_organizationId_idx" ON "AiConversationMessage"("organizationId");
ALTER TABLE "AiConversationMessage" ADD CONSTRAINT "AiConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
