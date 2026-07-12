-- Phase 13: Interoperabilidade FHIR / RNDS / Laboratórios

ALTER TABLE "Patient" ADD COLUMN "cnsEncrypted" TEXT;

CREATE TYPE "RndsEnvironment" AS ENUM ('HOMOLOGACAO', 'PRODUCAO');
CREATE TYPE "RndsCredentialStatus" AS ENUM ('PENDENTE', 'HOMOLOGACAO', 'PRODUCAO', 'REVOGADO');
CREATE TYPE "RndsCertificateType" AS ENUM ('A1', 'A3');
CREATE TYPE "RndsRegistrationType" AS ENUM ('RAC', 'EXAM_RESULT');
CREATE TYPE "RndsSubmissionStatus" AS ENUM ('FILA', 'ENVIADO', 'ACEITO', 'REJEITADO', 'ERRO', 'DLQ');
CREATE TYPE "LabReconciliationStatus" AS ENUM ('PENDENTE', 'CONCILIADO', 'REJEITADO');

ALTER TYPE "NotificationType" ADD VALUE 'LAB_RESULT_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'RNDS_SUBMISSION';

CREATE TABLE "RndsCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "certificateType" "RndsCertificateType" NOT NULL DEFAULT 'A1',
    "certificateEncrypted" TEXT,
    "certificateReference" TEXT,
    "requesterId" TEXT NOT NULL,
    "environment" "RndsEnvironment" NOT NULL DEFAULT 'HOMOLOGACAO',
    "credentialStatus" "RndsCredentialStatus" NOT NULL DEFAULT 'PENDENTE',
    "tokenExpiresAt" TIMESTAMP(3),
    "lastConnectionTestAt" TIMESTAMP(3),
    "lastConnectionOk" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RndsCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InteroperabilitySettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "autoSendRac" BOOLEAN NOT NULL DEFAULT true,
    "autoSendExamResults" BOOLEAN NOT NULL DEFAULT true,
    "examResultDeadlineHours" INTEGER NOT NULL DEFAULT 24,
    "labIntegrationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "labPollingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "labPollingIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InteroperabilitySettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RndsSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "registrationType" "RndsRegistrationType" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "bundleJson" JSONB NOT NULL,
    "protocol" TEXT,
    "status" "RndsSubmissionStatus" NOT NULL DEFAULT 'FILA',
    "responseJson" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RndsSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabResultReconciliation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalRequestId" TEXT,
    "inboundPayload" JSONB NOT NULL,
    "status" "LabReconciliationStatus" NOT NULL DEFAULT 'PENDENTE',
    "matchedRequestId" TEXT,
    "matchedResultId" TEXT,
    "ambiguityReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LabResultReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InteroperabilitySettings_organizationId_key" ON "InteroperabilitySettings"("organizationId");

CREATE INDEX "RndsCredential_organizationId_idx" ON "RndsCredential"("organizationId");
CREATE INDEX "RndsCredential_branchId_idx" ON "RndsCredential"("branchId");
CREATE INDEX "RndsSubmission_organizationId_status_idx" ON "RndsSubmission"("organizationId", "status");
CREATE INDEX "RndsSubmission_sourceType_sourceId_idx" ON "RndsSubmission"("sourceType", "sourceId");
CREATE INDEX "RndsSubmission_nextRetryAt_idx" ON "RndsSubmission"("nextRetryAt");
CREATE INDEX "RndsSubmission_credentialId_idx" ON "RndsSubmission"("credentialId");
CREATE INDEX "LabResultReconciliation_organizationId_status_idx" ON "LabResultReconciliation"("organizationId", "status");
CREATE INDEX "LabResultReconciliation_externalRequestId_idx" ON "LabResultReconciliation"("externalRequestId");

ALTER TABLE "RndsCredential" ADD CONSTRAINT "RndsCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RndsCredential" ADD CONSTRAINT "RndsCredential_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InteroperabilitySettings" ADD CONSTRAINT "InteroperabilitySettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RndsSubmission" ADD CONSTRAINT "RndsSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RndsSubmission" ADD CONSTRAINT "RndsSubmission_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "RndsCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabResultReconciliation" ADD CONSTRAINT "LabResultReconciliation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabResultReconciliation" ADD CONSTRAINT "LabResultReconciliation_matchedRequestId_fkey" FOREIGN KEY ("matchedRequestId") REFERENCES "ExamRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabResultReconciliation" ADD CONSTRAINT "LabResultReconciliation_matchedResultId_fkey" FOREIGN KEY ("matchedResultId") REFERENCES "ExamResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
