-- Phase 16D: Assinatura digital ICP-Brasil + trilha SBIS/NGS2

CREATE TYPE "SignatureProvider" AS ENUM ('DEV_SIMPLE', 'ICP_A1', 'ICP_DSAS');
CREATE TYPE "SignedEntityType" AS ENUM ('ENCOUNTER', 'PRESCRIPTION', 'MEDICAL_CERTIFICATE', 'EXAM_RESULT');

CREATE TABLE "SignatureSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "SignatureProvider" NOT NULL DEFAULT 'DEV_SIMPLE',
    "certificateEncrypted" TEXT,
    "certificatePasswordEncrypted" TEXT,
    "dsasApiUrl" TEXT,
    "dsasApiKeyEncrypted" TEXT,
    "timestampEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SignedClinicalDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" "SignedEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "signatureMethod" "SignatureProvider" NOT NULL,
    "signatureMeta" JSONB NOT NULL DEFAULT '{}',
    "timestampToken" TEXT,
    "pdfStorageKey" TEXT,
    "signerUserId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignedClinicalDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SignatureSettings_organizationId_key" ON "SignatureSettings"("organizationId");
CREATE INDEX "SignatureSettings_organizationId_idx" ON "SignatureSettings"("organizationId");

CREATE UNIQUE INDEX "SignedClinicalDocument_verificationCode_key" ON "SignedClinicalDocument"("verificationCode");
CREATE UNIQUE INDEX "SignedClinicalDocument_organizationId_entityType_entityId_key" ON "SignedClinicalDocument"("organizationId", "entityType", "entityId");
CREATE INDEX "SignedClinicalDocument_organizationId_idx" ON "SignedClinicalDocument"("organizationId");
CREATE INDEX "SignedClinicalDocument_verificationCode_idx" ON "SignedClinicalDocument"("verificationCode");
CREATE INDEX "SignedClinicalDocument_contentHash_idx" ON "SignedClinicalDocument"("contentHash");

ALTER TABLE "SignatureSettings" ADD CONSTRAINT "SignatureSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SignedClinicalDocument" ADD CONSTRAINT "SignedClinicalDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
