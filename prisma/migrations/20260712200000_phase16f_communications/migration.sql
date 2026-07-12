-- Phase 16F: Comunicação real (WhatsApp, e-mail, PIX) + central de conversas

CREATE TYPE "MessagingProviderType" AS ENUM ('CONSOLE', 'WHATSAPP_CLOUD');
CREATE TYPE "EmailProviderType" AS ENUM ('CONSOLE', 'RESEND', 'SES');
CREATE TYPE "PaymentProviderType" AS ENUM ('MOCK', 'EFI_PIX');
CREATE TYPE "PaymentLinkStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');
CREATE TYPE "ConversationThreadStatus" AS ENUM ('OPEN', 'HANDOFF', 'CLOSED');
CREATE TYPE "ConversationMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

ALTER TABLE "OnlineBookingConfig" ADD COLUMN "requirePrepayment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OnlineBookingConfig" ADD COLUMN "prepaymentPercent" INTEGER NOT NULL DEFAULT 100;

CREATE TABLE "MessagingSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "messagingProvider" "MessagingProviderType" NOT NULL DEFAULT 'CONSOLE',
    "whatsappPhoneNumberId" TEXT,
    "whatsappAccessTokenEncrypted" TEXT,
    "whatsappBusinessAccountId" TEXT,
    "emailProvider" "EmailProviderType" NOT NULL DEFAULT 'CONSOLE',
    "emailFrom" TEXT,
    "emailReplyTo" TEXT,
    "resendApiKeyEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "PaymentProviderType" NOT NULL DEFAULT 'MOCK',
    "efiClientId" TEXT,
    "efiClientSecretEncrypted" TEXT,
    "efiPixKey" TEXT,
    "efiSandbox" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatientPaymentLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT,
    "receivableId" TEXT,
    "externalId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "pixCopyPaste" TEXT,
    "pixQrCodeBase64" TEXT,
    "status" "PaymentLinkStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientPaymentLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationThread" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT,
    "phone" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "status" "ConversationThreadStatus" NOT NULL DEFAULT 'OPEN',
    "aiConversationId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "direction" "ConversationMessageDirection" NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "body" TEXT NOT NULL,
    "communicationLogId" TEXT,
    "externalMessageId" TEXT,
    "sentByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessagingSettings_organizationId_key" ON "MessagingSettings"("organizationId");
CREATE INDEX "MessagingSettings_organizationId_idx" ON "MessagingSettings"("organizationId");

CREATE UNIQUE INDEX "PaymentSettings_organizationId_key" ON "PaymentSettings"("organizationId");
CREATE INDEX "PaymentSettings_organizationId_idx" ON "PaymentSettings"("organizationId");

CREATE INDEX "PatientPaymentLink_organizationId_idx" ON "PatientPaymentLink"("organizationId");
CREATE INDEX "PatientPaymentLink_patientId_idx" ON "PatientPaymentLink"("patientId");
CREATE INDEX "PatientPaymentLink_receivableId_idx" ON "PatientPaymentLink"("receivableId");
CREATE INDEX "PatientPaymentLink_status_idx" ON "PatientPaymentLink"("status");
CREATE INDEX "PatientPaymentLink_externalId_idx" ON "PatientPaymentLink"("externalId");

CREATE UNIQUE INDEX "ConversationThread_organizationId_phone_key" ON "ConversationThread"("organizationId", "phone");
CREATE INDEX "ConversationThread_organizationId_idx" ON "ConversationThread"("organizationId");
CREATE INDEX "ConversationThread_patientId_idx" ON "ConversationThread"("patientId");
CREATE INDEX "ConversationThread_status_idx" ON "ConversationThread"("status");
CREATE INDEX "ConversationThread_lastMessageAt_idx" ON "ConversationThread"("lastMessageAt");

CREATE INDEX "ConversationMessage_threadId_idx" ON "ConversationMessage"("threadId");
CREATE INDEX "ConversationMessage_organizationId_idx" ON "ConversationMessage"("organizationId");
CREATE INDEX "ConversationMessage_createdAt_idx" ON "ConversationMessage"("createdAt");

ALTER TABLE "MessagingSettings" ADD CONSTRAINT "MessagingSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentSettings" ADD CONSTRAINT "PaymentSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientPaymentLink" ADD CONSTRAINT "PatientPaymentLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientPaymentLink" ADD CONSTRAINT "PatientPaymentLink_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PatientPaymentLink" ADD CONSTRAINT "PatientPaymentLink_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ConversationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
