-- Phase 16G: IA clínica — Scribe + anomalias BI

CREATE TYPE "ScribeSessionStatus" AS ENUM ('STARTED', 'CONSENTED', 'TRANSCRIBED', 'SOAP_READY', 'APPLIED', 'DISCARDED');

ALTER TYPE "NotificationType" ADD VALUE 'BI_ANOMALY';

ALTER TABLE "AiSettings" ADD COLUMN "discardAudioAfterTranscription" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "ScribeSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentRecordedAt" TIMESTAMP(3),
    "transcriptEncrypted" TEXT,
    "soapDraft" JSONB,
    "transcribeLogId" TEXT,
    "soapLogId" TEXT,
    "status" "ScribeSessionStatus" NOT NULL DEFAULT 'STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScribeSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScribeSession_organizationId_idx" ON "ScribeSession"("organizationId");
CREATE INDEX "ScribeSession_encounterId_idx" ON "ScribeSession"("encounterId");
CREATE INDEX "ScribeSession_patientId_idx" ON "ScribeSession"("patientId");

ALTER TABLE "ScribeSession" ADD CONSTRAINT "ScribeSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScribeSession" ADD CONSTRAINT "ScribeSession_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
