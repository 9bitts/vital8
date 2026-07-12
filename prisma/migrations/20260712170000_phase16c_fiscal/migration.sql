-- Phase 16C: NFS-e Padrão Nacional + Receita Saúde

CREATE TYPE "TaxRegime" AS ENUM ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI');
CREATE TYPE "NfseProvider" AS ENUM ('MOCK', 'NFSE_NACIONAL');
CREATE TYPE "FiscalDocumentType" AS ENUM ('NFSE', 'RECIBO_RECEITA_SAUDE');
CREATE TYPE "FiscalDocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'ISSUED', 'FAILED', 'CANCELLED', 'REPLACED');
CREATE TYPE "FiscalEmitProfile" AS ENUM ('AUTO', 'NFSE_ONLY', 'RECEITA_SAUDE_ONLY');

ALTER TABLE "FinancialCategory" ADD COLUMN "cbsApplicable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FinancialCategory" ADD COLUMN "ibsApplicable" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "FiscalSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxRegime" "TaxRegime" NOT NULL DEFAULT 'SIMPLES_NACIONAL',
    "cnae" TEXT,
    "nacionalServiceCode" TEXT,
    "issRateBasisPoints" INTEGER NOT NULL DEFAULT 500,
    "certificateEncrypted" TEXT,
    "certificatePasswordEncrypted" TEXT,
    "nfseProvider" "NfseProvider" NOT NULL DEFAULT 'MOCK',
    "autoEmitOnPayment" BOOLEAN NOT NULL DEFAULT false,
    "emitProfile" "FiscalEmitProfile" NOT NULL DEFAULT 'AUTO',
    "municipioIbgeCode" TEXT,
    "inscricaoMunicipal" TEXT,
    "cbsIbsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cbsRateBasisPoints" INTEGER,
    "ibsRateBasisPoints" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FiscalDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentType" "FiscalDocumentType" NOT NULL,
    "status" "FiscalDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "number" TEXT,
    "accessKey" TEXT,
    "dpsNumber" TEXT,
    "amountCents" INTEGER NOT NULL,
    "patientId" TEXT NOT NULL,
    "paymentId" TEXT,
    "saleId" TEXT,
    "professionalId" TEXT,
    "patientCpfEncrypted" TEXT,
    "serviceDescription" TEXT,
    "responsePayload" JSONB,
    "pdfStorageKey" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "replacesDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FiscalSettings_organizationId_key" ON "FiscalSettings"("organizationId");
CREATE INDEX "FiscalSettings_organizationId_idx" ON "FiscalSettings"("organizationId");

CREATE INDEX "FiscalDocument_organizationId_idx" ON "FiscalDocument"("organizationId");
CREATE INDEX "FiscalDocument_organizationId_status_idx" ON "FiscalDocument"("organizationId", "status");
CREATE INDEX "FiscalDocument_patientId_idx" ON "FiscalDocument"("patientId");
CREATE INDEX "FiscalDocument_paymentId_idx" ON "FiscalDocument"("paymentId");
CREATE INDEX "FiscalDocument_nextRetryAt_idx" ON "FiscalDocument"("nextRetryAt");
CREATE INDEX "FiscalDocument_documentType_idx" ON "FiscalDocument"("documentType");

ALTER TABLE "FiscalSettings" ADD CONSTRAINT "FiscalSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_replacesDocumentId_fkey" FOREIGN KEY ("replacesDocumentId") REFERENCES "FiscalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
