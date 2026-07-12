-- Phase 6: TISS/TUSS billing

-- AlterEnum
ALTER TYPE "ReceivableOrigin" ADD VALUE 'TISS_BATCH';

-- CreateEnum
CREATE TYPE "PriorAuthorizationStatus" AS ENUM ('SOLICITADA', 'AUTORIZADA', 'NEGADA', 'EXPIRADA');
CREATE TYPE "TissGuideType" AS ENUM ('GUIA_CONSULTA', 'GUIA_SP_SADT');
CREATE TYPE "TissGuideStatus" AS ENUM ('RASCUNHO', 'PRONTA', 'EM_LOTE', 'ENVIADA', 'PAGA', 'GLOSADA_PARCIAL', 'GLOSADA_TOTAL');
CREATE TYPE "TissBatchStatus" AS ENUM ('ABERTO', 'FECHADO', 'ENVIADO', 'CONCILIADO', 'REABERTO');
CREATE TYPE "GlosaItemStatus" AS ENUM ('ACEITA', 'EM_RECURSO', 'RECUPERADA', 'PERDIDA');
CREATE TYPE "TissSequenceType" AS ENUM ('GUIDE', 'BATCH');
CREATE TYPE "TissAccidentIndication" AS ENUM ('NAO_ACIDENTE', 'ACIDENTE_TRABALHO', 'ACIDENTE_TRANSITO', 'OUTROS_ACIDENTES');
CREATE TYPE "TissServiceCharacter" AS ENUM ('ELETIVO', 'URGENCIA');
CREATE TYPE "TissConsultationType" AS ENUM ('PRIMEIRA', 'SEGUIMENTO', 'PRE_NATAL', 'REFERENCIADA');

-- AlterTable
ALTER TABLE "PatientInsurancePlan" ADD COLUMN "healthInsurerId" TEXT;
ALTER TABLE "Service" ADD COLUMN "tussProcedureId" TEXT;
ALTER TABLE "Receivable" ADD COLUMN "healthInsurerId" TEXT;
ALTER TABLE "Receivable" ADD COLUMN "tissBatchId" TEXT;

-- CreateTable
CREATE TABLE "TussProcedure" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "tableType" TEXT NOT NULL DEFAULT '22',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TussProcedure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GlosaReasonCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GlosaReasonCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HealthInsurer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ansRegistration" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "tissVersion" TEXT NOT NULL DEFAULT '3.05.00',
    "providerCodeAtInsurer" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "batchClosingDay" INTEGER NOT NULL DEFAULT 25,
    "requiresAuthorization" BOOLEAN NOT NULL DEFAULT false,
    "authProcedureTypes" JSONB NOT NULL DEFAULT '[]',
    "coparticipationPercent" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "HealthInsurer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsurerContract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "healthInsurerId" TEXT NOT NULL,
    "priceTableId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "adjustmentNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "InsurerContract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriorAuthorization" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "healthInsurerId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "serviceId" TEXT,
    "tussProcedureId" TEXT,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "password" TEXT,
    "validUntil" DATE,
    "authorizedQty" INTEGER NOT NULL DEFAULT 1,
    "consumedQty" INTEGER NOT NULL DEFAULT 0,
    "status" "PriorAuthorizationStatus" NOT NULL DEFAULT 'SOLICITADA',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PriorAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TissGuide" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "healthInsurerId" TEXT NOT NULL,
    "priorAuthorizationId" TEXT,
    "tissBatchId" TEXT,
    "guideType" "TissGuideType" NOT NULL,
    "guideNumber" INTEGER NOT NULL,
    "status" "TissGuideStatus" NOT NULL DEFAULT 'RASCUNHO',
    "competence" TEXT NOT NULL,
    "validationErrors" JSONB NOT NULL DEFAULT '[]',
    "beneficiaryName" TEXT NOT NULL,
    "beneficiaryCard" TEXT NOT NULL,
    "beneficiaryCardValidUntil" DATE,
    "ansRegistration" TEXT NOT NULL,
    "providerCnes" TEXT,
    "providerDocument" TEXT NOT NULL,
    "providerCouncil" TEXT,
    "providerCouncilNumber" TEXT,
    "providerCouncilState" TEXT,
    "professionalName" TEXT NOT NULL,
    "professionalCouncil" TEXT,
    "professionalCouncilNumber" TEXT,
    "professionalCouncilState" TEXT,
    "accidentIndication" "TissAccidentIndication" NOT NULL DEFAULT 'NAO_ACIDENTE',
    "serviceCharacter" "TissServiceCharacter" NOT NULL DEFAULT 'ELETIVO',
    "consultationType" "TissConsultationType",
    "cid10Code" TEXT,
    "procedures" JSONB NOT NULL DEFAULT '[]',
    "totalValueCents" INTEGER NOT NULL DEFAULT 0,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "TissGuide_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TissBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "healthInsurerId" TEXT NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "competence" TEXT NOT NULL,
    "status" "TissBatchStatus" NOT NULL DEFAULT 'ABERTO',
    "xmlHash" TEXT,
    "xmlStorageKey" TEXT,
    "sendProtocol" TEXT,
    "sentAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "reopenedByUserId" TEXT,
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "TissBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TissSequence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "healthInsurerId" TEXT NOT NULL,
    "sequenceType" "TissSequenceType" NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TissSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GlosaItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tissGuideId" TEXT NOT NULL,
    "insurerPaymentId" TEXT,
    "tussProcedureCode" TEXT NOT NULL,
    "glosaReasonCode" TEXT NOT NULL,
    "reasonText" TEXT,
    "glosedAmountCents" INTEGER NOT NULL,
    "status" "GlosaItemStatus" NOT NULL DEFAULT 'ACEITA',
    "appealDeadline" DATE,
    "appealJustification" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GlosaItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsurerPayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "healthInsurerId" TEXT NOT NULL,
    "tissBatchId" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "grossAmountCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "netAmountCents" INTEGER NOT NULL,
    "notes" TEXT,
    "guidePayments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InsurerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TussProcedure_code_key" ON "TussProcedure"("code");
CREATE UNIQUE INDEX "GlosaReasonCode_code_key" ON "GlosaReasonCode"("code");
CREATE UNIQUE INDEX "HealthInsurer_organizationId_ansRegistration_key" ON "HealthInsurer"("organizationId", "ansRegistration");
CREATE INDEX "HealthInsurer_organizationId_idx" ON "HealthInsurer"("organizationId");
CREATE INDEX "HealthInsurer_deletedAt_idx" ON "HealthInsurer"("deletedAt");
CREATE INDEX "InsurerContract_organizationId_idx" ON "InsurerContract"("organizationId");
CREATE INDEX "InsurerContract_healthInsurerId_idx" ON "InsurerContract"("healthInsurerId");
CREATE INDEX "InsurerContract_priceTableId_idx" ON "InsurerContract"("priceTableId");
CREATE INDEX "InsurerContract_deletedAt_idx" ON "InsurerContract"("deletedAt");
CREATE INDEX "PriorAuthorization_organizationId_idx" ON "PriorAuthorization"("organizationId");
CREATE INDEX "PriorAuthorization_healthInsurerId_idx" ON "PriorAuthorization"("healthInsurerId");
CREATE INDEX "PriorAuthorization_patientId_idx" ON "PriorAuthorization"("patientId");
CREATE INDEX "PriorAuthorization_status_idx" ON "PriorAuthorization"("status");
CREATE INDEX "PriorAuthorization_validUntil_idx" ON "PriorAuthorization"("validUntil");
CREATE INDEX "PriorAuthorization_deletedAt_idx" ON "PriorAuthorization"("deletedAt");
CREATE UNIQUE INDEX "TissGuide_appointmentId_key" ON "TissGuide"("appointmentId");
CREATE UNIQUE INDEX "TissGuide_organizationId_healthInsurerId_guideNumber_key" ON "TissGuide"("organizationId", "healthInsurerId", "guideNumber");
CREATE INDEX "TissGuide_organizationId_idx" ON "TissGuide"("organizationId");
CREATE INDEX "TissGuide_healthInsurerId_idx" ON "TissGuide"("healthInsurerId");
CREATE INDEX "TissGuide_tissBatchId_idx" ON "TissGuide"("tissBatchId");
CREATE INDEX "TissGuide_status_idx" ON "TissGuide"("status");
CREATE INDEX "TissGuide_competence_idx" ON "TissGuide"("competence");
CREATE INDEX "TissGuide_deletedAt_idx" ON "TissGuide"("deletedAt");
CREATE UNIQUE INDEX "TissBatch_organizationId_healthInsurerId_batchNumber_key" ON "TissBatch"("organizationId", "healthInsurerId", "batchNumber");
CREATE INDEX "TissBatch_organizationId_idx" ON "TissBatch"("organizationId");
CREATE INDEX "TissBatch_healthInsurerId_idx" ON "TissBatch"("healthInsurerId");
CREATE INDEX "TissBatch_competence_idx" ON "TissBatch"("competence");
CREATE INDEX "TissBatch_status_idx" ON "TissBatch"("status");
CREATE INDEX "TissBatch_deletedAt_idx" ON "TissBatch"("deletedAt");
CREATE UNIQUE INDEX "TissSequence_organizationId_healthInsurerId_sequenceType_key" ON "TissSequence"("organizationId", "healthInsurerId", "sequenceType");
CREATE INDEX "TissSequence_organizationId_idx" ON "TissSequence"("organizationId");
CREATE INDEX "GlosaItem_organizationId_idx" ON "GlosaItem"("organizationId");
CREATE INDEX "GlosaItem_tissGuideId_idx" ON "GlosaItem"("tissGuideId");
CREATE INDEX "GlosaItem_insurerPaymentId_idx" ON "GlosaItem"("insurerPaymentId");
CREATE INDEX "GlosaItem_status_idx" ON "GlosaItem"("status");
CREATE INDEX "InsurerPayment_organizationId_idx" ON "InsurerPayment"("organizationId");
CREATE INDEX "InsurerPayment_healthInsurerId_idx" ON "InsurerPayment"("healthInsurerId");
CREATE INDEX "InsurerPayment_tissBatchId_idx" ON "InsurerPayment"("tissBatchId");
CREATE INDEX "PatientInsurancePlan_healthInsurerId_idx" ON "PatientInsurancePlan"("healthInsurerId");
CREATE INDEX "Service_tussProcedureId_idx" ON "Service"("tussProcedureId");
CREATE INDEX "Appointment_patientInsurancePlanId_idx" ON "Appointment"("patientInsurancePlanId");
CREATE UNIQUE INDEX "Receivable_tissBatchId_key" ON "Receivable"("tissBatchId");
CREATE INDEX "Receivable_healthInsurerId_idx" ON "Receivable"("healthInsurerId");

-- AddForeignKey
ALTER TABLE "PatientInsurancePlan" ADD CONSTRAINT "PatientInsurancePlan_healthInsurerId_fkey" FOREIGN KEY ("healthInsurerId") REFERENCES "HealthInsurer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_tussProcedureId_fkey" FOREIGN KEY ("tussProcedureId") REFERENCES "TussProcedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_healthInsurerId_fkey" FOREIGN KEY ("healthInsurerId") REFERENCES "HealthInsurer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_tissBatchId_fkey" FOREIGN KEY ("tissBatchId") REFERENCES "TissBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HealthInsurer" ADD CONSTRAINT "HealthInsurer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsurerContract" ADD CONSTRAINT "InsurerContract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsurerContract" ADD CONSTRAINT "InsurerContract_healthInsurerId_fkey" FOREIGN KEY ("healthInsurerId") REFERENCES "HealthInsurer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsurerContract" ADD CONSTRAINT "InsurerContract_priceTableId_fkey" FOREIGN KEY ("priceTableId") REFERENCES "PriceTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriorAuthorization" ADD CONSTRAINT "PriorAuthorization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriorAuthorization" ADD CONSTRAINT "PriorAuthorization_healthInsurerId_fkey" FOREIGN KEY ("healthInsurerId") REFERENCES "HealthInsurer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriorAuthorization" ADD CONSTRAINT "PriorAuthorization_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriorAuthorization" ADD CONSTRAINT "PriorAuthorization_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PriorAuthorization" ADD CONSTRAINT "PriorAuthorization_tussProcedureId_fkey" FOREIGN KEY ("tussProcedureId") REFERENCES "TussProcedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TissGuide" ADD CONSTRAINT "TissGuide_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TissGuide" ADD CONSTRAINT "TissGuide_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TissGuide" ADD CONSTRAINT "TissGuide_healthInsurerId_fkey" FOREIGN KEY ("healthInsurerId") REFERENCES "HealthInsurer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TissGuide" ADD CONSTRAINT "TissGuide_priorAuthorizationId_fkey" FOREIGN KEY ("priorAuthorizationId") REFERENCES "PriorAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TissGuide" ADD CONSTRAINT "TissGuide_tissBatchId_fkey" FOREIGN KEY ("tissBatchId") REFERENCES "TissBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TissBatch" ADD CONSTRAINT "TissBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TissBatch" ADD CONSTRAINT "TissBatch_healthInsurerId_fkey" FOREIGN KEY ("healthInsurerId") REFERENCES "HealthInsurer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TissSequence" ADD CONSTRAINT "TissSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TissSequence" ADD CONSTRAINT "TissSequence_healthInsurerId_fkey" FOREIGN KEY ("healthInsurerId") REFERENCES "HealthInsurer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GlosaItem" ADD CONSTRAINT "GlosaItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GlosaItem" ADD CONSTRAINT "GlosaItem_tissGuideId_fkey" FOREIGN KEY ("tissGuideId") REFERENCES "TissGuide"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GlosaItem" ADD CONSTRAINT "GlosaItem_insurerPaymentId_fkey" FOREIGN KEY ("insurerPaymentId") REFERENCES "InsurerPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GlosaItem" ADD CONSTRAINT "GlosaItem_glosaReasonCode_fkey" FOREIGN KEY ("glosaReasonCode") REFERENCES "GlosaReasonCode"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsurerPayment" ADD CONSTRAINT "InsurerPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsurerPayment" ADD CONSTRAINT "InsurerPayment_healthInsurerId_fkey" FOREIGN KEY ("healthInsurerId") REFERENCES "HealthInsurer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsurerPayment" ADD CONSTRAINT "InsurerPayment_tissBatchId_fkey" FOREIGN KEY ("tissBatchId") REFERENCES "TissBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientInsurancePlanId_fkey" FOREIGN KEY ("patientInsurancePlanId") REFERENCES "PatientInsurancePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
