-- Phase 16E: Prescrição digital integrada

CREATE TYPE "PrescriptionProviderType" AS ENUM ('LOCAL', 'MEMED');
CREATE TYPE "DrugInteractionSeverity" AS ENUM ('WARNING', 'BLOCKING');

ALTER TABLE "Prescription" ADD COLUMN "provider" "PrescriptionProviderType" NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "Prescription" ADD COLUMN "validationCode" TEXT;
ALTER TABLE "Prescription" ADD COLUMN "validationUrl" TEXT;
ALTER TABLE "Prescription" ADD COLUMN "controlBookNumber" TEXT;
ALTER TABLE "Prescription" ADD COLUMN "memedExternalId" TEXT;
ALTER TABLE "Prescription" ADD COLUMN "sentToPatientAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Prescription_validationCode_key" ON "Prescription"("validationCode");
CREATE INDEX "Prescription_validationCode_idx" ON "Prescription"("validationCode");

CREATE INDEX "DrugCatalog_activeIngredient_idx" ON "DrugCatalog"("activeIngredient");

CREATE TABLE "DrugInteraction" (
    "id" TEXT NOT NULL,
    "drugCatalogIdA" TEXT,
    "drugCatalogIdB" TEXT,
    "activeIngredientA" TEXT NOT NULL,
    "activeIngredientB" TEXT NOT NULL,
    "severity" "DrugInteractionSeverity" NOT NULL DEFAULT 'WARNING',
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugInteraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrescriptionSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "PrescriptionProviderType" NOT NULL DEFAULT 'LOCAL',
    "memedPartnerId" TEXT,
    "memedApiKeyEncrypted" TEXT,
    "blockOnAllergyConflict" BOOLEAN NOT NULL DEFAULT true,
    "blockOnDrugInteraction" BOOLEAN NOT NULL DEFAULT false,
    "autoSendToPatient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrescriptionControlSequence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionControlSequence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DrugInteraction_activeIngredientA_idx" ON "DrugInteraction"("activeIngredientA");
CREATE INDEX "DrugInteraction_activeIngredientB_idx" ON "DrugInteraction"("activeIngredientB");

CREATE UNIQUE INDEX "PrescriptionSettings_organizationId_key" ON "PrescriptionSettings"("organizationId");
CREATE INDEX "PrescriptionSettings_organizationId_idx" ON "PrescriptionSettings"("organizationId");

CREATE UNIQUE INDEX "PrescriptionControlSequence_organizationId_professionalId_key" ON "PrescriptionControlSequence"("organizationId", "professionalId");
CREATE INDEX "PrescriptionControlSequence_organizationId_idx" ON "PrescriptionControlSequence"("organizationId");

ALTER TABLE "DrugInteraction" ADD CONSTRAINT "DrugInteraction_drugCatalogIdA_fkey" FOREIGN KEY ("drugCatalogIdA") REFERENCES "DrugCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DrugInteraction" ADD CONSTRAINT "DrugInteraction_drugCatalogIdB_fkey" FOREIGN KEY ("drugCatalogIdB") REFERENCES "DrugCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PrescriptionSettings" ADD CONSTRAINT "PrescriptionSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrescriptionControlSequence" ADD CONSTRAINT "PrescriptionControlSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
