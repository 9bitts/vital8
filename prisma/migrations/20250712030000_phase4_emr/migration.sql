-- CreateEnum
CREATE TYPE "EncounterModality" AS ENUM ('PRESENCIAL', 'TELECONSULTA');
CREATE TYPE "EncounterStatus" AS ENUM ('RASCUNHO', 'ASSINADO');
CREATE TYPE "EncounterSectionType" AS ENUM ('ANAMNESE', 'EXAME_FISICO', 'EVOLUCAO_SOAP', 'HIPOTESE_DIAGNOSTICA', 'CONDUTA', 'REGISTRO_RESERVADO', 'PLANO_TRATAMENTO', 'ANTROPOMETRIA', 'EVOLUCAO_FISIO', 'ODONTOGRAMA');
CREATE TYPE "PrescriptionType" AS ENUM ('COMUM', 'CONTROLE_ESPECIAL');
CREATE TYPE "MedicalCertificateType" AS ENUM ('ATESTADO', 'DECLARACAO', 'COMPARECIMENTO');
CREATE TYPE "RecordResourceType" AS ENUM ('ENCOUNTER', 'PRESCRIPTION', 'EXAM_RESULT', 'MEDICAL_CERTIFICATE', 'ENCOUNTER_AMENDMENT');
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'NUMBER', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE', 'DATE', 'TABLE');
CREATE TYPE "OdontogramEntryStatus" AS ENUM ('PLANEJADO', 'REALIZADO', 'EXISTENTE');

-- CreateTable
CREATE TABLE "Cid10Code" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "chapter" TEXT,
    CONSTRAINT "Cid10Code_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DrugCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activeIngredient" TEXT,
    "concentration" TEXT,
    "pharmaceuticalForm" TEXT,
    "route" TEXT,
    "isControlled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DrugCatalog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "modality" "EncounterModality" NOT NULL DEFAULT 'PRESENCIAL',
    "specialty" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" "EncounterStatus" NOT NULL DEFAULT 'RASCUNHO',
    "contentHash" TEXT,
    "signedAt" TIMESTAMP(3),
    "signatureMeta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EncounterSection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "sectionType" "EncounterSectionType" NOT NULL,
    "contentEncrypted" TEXT,
    "structuredData" JSONB NOT NULL DEFAULT '{}',
    "restrictedToAuthor" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EncounterSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EncounterAmendment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "contentEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EncounterAmendment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormTemplateVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "schema" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormResponse" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "answersEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "type" "PrescriptionType" NOT NULL DEFAULT 'COMUM',
    "notesEncrypted" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrescriptionItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "drugCatalogId" TEXT,
    "drugName" TEXT NOT NULL,
    "concentration" TEXT,
    "pharmaceuticalForm" TEXT,
    "dosage" TEXT NOT NULL,
    "route" TEXT,
    "duration" TEXT,
    "quantity" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MedicalCertificate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "type" "MedicalCertificateType" NOT NULL,
    "templateId" TEXT,
    "contentEncrypted" TEXT NOT NULL,
    "cidCode" TEXT,
    "patientConsentRecorded" BOOLEAN NOT NULL DEFAULT false,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "MedicalCertificate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "type" "MedicalCertificateType",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "notesEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "ExamRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamRequestItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "examName" TEXT NOT NULL,
    "instructions" TEXT,
    CONSTRAINT "ExamRequestItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "requestId" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "storageKey" TEXT,
    "notesEncrypted" TEXT,
    "resultedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "ExamResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamResultValue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "referenceRange" TEXT,
    CONSTRAINT "ExamResultValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Odontogram" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    CONSTRAINT "Odontogram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdontogramEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "odontogramId" TEXT NOT NULL,
    "toothFdi" INTEGER NOT NULL,
    "face" TEXT,
    "finding" TEXT,
    "procedure" TEXT,
    "status" "OdontogramEntryStatus" NOT NULL DEFAULT 'PLANEJADO',
    CONSTRAINT "OdontogramEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BodyChartEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "noteEncrypted" TEXT,
    CONSTRAINT "BodyChartEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecordAccessLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "resourceType" "RecordResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'view',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecordAccessLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "Cid10Code_code_key" ON "Cid10Code"("code");
CREATE INDEX "Cid10Code_description_idx" ON "Cid10Code"("description");
CREATE INDEX "DrugCatalog_name_idx" ON "DrugCatalog"("name");

CREATE UNIQUE INDEX "Encounter_appointmentId_key" ON "Encounter"("appointmentId");
CREATE INDEX "Encounter_organizationId_idx" ON "Encounter"("organizationId");
CREATE INDEX "Encounter_patientId_startedAt_idx" ON "Encounter"("patientId", "startedAt");
CREATE INDEX "Encounter_professionalId_idx" ON "Encounter"("professionalId");
CREATE INDEX "Encounter_status_idx" ON "Encounter"("status");
CREATE INDEX "Encounter_deletedAt_idx" ON "Encounter"("deletedAt");

CREATE INDEX "EncounterSection_organizationId_idx" ON "EncounterSection"("organizationId");
CREATE INDEX "EncounterSection_encounterId_idx" ON "EncounterSection"("encounterId");

CREATE INDEX "EncounterAmendment_organizationId_idx" ON "EncounterAmendment"("organizationId");
CREATE INDEX "EncounterAmendment_encounterId_idx" ON "EncounterAmendment"("encounterId");

CREATE INDEX "FormTemplate_organizationId_idx" ON "FormTemplate"("organizationId");
CREATE INDEX "FormTemplate_deletedAt_idx" ON "FormTemplate"("deletedAt");

CREATE UNIQUE INDEX "FormTemplateVersion_templateId_version_key" ON "FormTemplateVersion"("templateId", "version");
CREATE INDEX "FormTemplateVersion_organizationId_idx" ON "FormTemplateVersion"("organizationId");

CREATE INDEX "FormResponse_organizationId_idx" ON "FormResponse"("organizationId");
CREATE INDEX "FormResponse_encounterId_idx" ON "FormResponse"("encounterId");

CREATE INDEX "Prescription_organizationId_idx" ON "Prescription"("organizationId");
CREATE INDEX "Prescription_encounterId_idx" ON "Prescription"("encounterId");
CREATE INDEX "Prescription_patientId_idx" ON "Prescription"("patientId");
CREATE INDEX "Prescription_deletedAt_idx" ON "Prescription"("deletedAt");

CREATE INDEX "PrescriptionItem_organizationId_idx" ON "PrescriptionItem"("organizationId");
CREATE INDEX "PrescriptionItem_prescriptionId_idx" ON "PrescriptionItem"("prescriptionId");

CREATE INDEX "MedicalCertificate_organizationId_idx" ON "MedicalCertificate"("organizationId");
CREATE INDEX "MedicalCertificate_encounterId_idx" ON "MedicalCertificate"("encounterId");
CREATE INDEX "MedicalCertificate_patientId_idx" ON "MedicalCertificate"("patientId");

CREATE INDEX "DocumentTemplate_organizationId_idx" ON "DocumentTemplate"("organizationId");
CREATE INDEX "DocumentTemplate_deletedAt_idx" ON "DocumentTemplate"("deletedAt");

CREATE INDEX "ExamRequest_organizationId_idx" ON "ExamRequest"("organizationId");
CREATE INDEX "ExamRequest_encounterId_idx" ON "ExamRequest"("encounterId");
CREATE INDEX "ExamRequest_patientId_idx" ON "ExamRequest"("patientId");

CREATE INDEX "ExamRequestItem_organizationId_idx" ON "ExamRequestItem"("organizationId");
CREATE INDEX "ExamRequestItem_requestId_idx" ON "ExamRequestItem"("requestId");

CREATE INDEX "ExamResult_organizationId_idx" ON "ExamResult"("organizationId");
CREATE INDEX "ExamResult_patientId_idx" ON "ExamResult"("patientId");
CREATE INDEX "ExamResult_encounterId_idx" ON "ExamResult"("encounterId");

CREATE INDEX "ExamResultValue_organizationId_idx" ON "ExamResultValue"("organizationId");
CREATE INDEX "ExamResultValue_resultId_idx" ON "ExamResultValue"("resultId");

CREATE UNIQUE INDEX "Odontogram_encounterId_key" ON "Odontogram"("encounterId");
CREATE INDEX "Odontogram_organizationId_idx" ON "Odontogram"("organizationId");

CREATE INDEX "OdontogramEntry_organizationId_idx" ON "OdontogramEntry"("organizationId");
CREATE INDEX "OdontogramEntry_odontogramId_idx" ON "OdontogramEntry"("odontogramId");

CREATE INDEX "BodyChartEntry_organizationId_idx" ON "BodyChartEntry"("organizationId");
CREATE INDEX "BodyChartEntry_encounterId_idx" ON "BodyChartEntry"("encounterId");

CREATE INDEX "RecordAccessLog_organizationId_idx" ON "RecordAccessLog"("organizationId");
CREATE INDEX "RecordAccessLog_resourceType_resourceId_idx" ON "RecordAccessLog"("resourceType", "resourceId");
CREATE INDEX "RecordAccessLog_userId_idx" ON "RecordAccessLog"("userId");
CREATE INDEX "RecordAccessLog_createdAt_idx" ON "RecordAccessLog"("createdAt");

-- ForeignKeys
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EncounterSection" ADD CONSTRAINT "EncounterSection_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EncounterAmendment" ADD CONSTRAINT "EncounterAmendment_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormTemplateVersion" ADD CONSTRAINT "FormTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FormTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_drugCatalogId_fkey" FOREIGN KEY ("drugCatalogId") REFERENCES "DrugCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MedicalCertificate" ADD CONSTRAINT "MedicalCertificate_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicalCertificate" ADD CONSTRAINT "MedicalCertificate_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExamRequest" ADD CONSTRAINT "ExamRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamRequest" ADD CONSTRAINT "ExamRequest_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamRequest" ADD CONSTRAINT "ExamRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamRequestItem" ADD CONSTRAINT "ExamRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExamRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExamRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExamResultValue" ADD CONSTRAINT "ExamResultValue_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "ExamResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Odontogram" ADD CONSTRAINT "Odontogram_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OdontogramEntry" ADD CONSTRAINT "OdontogramEntry_odontogramId_fkey" FOREIGN KEY ("odontogramId") REFERENCES "Odontogram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BodyChartEntry" ADD CONSTRAINT "BodyChartEntry_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecordAccessLog" ADD CONSTRAINT "RecordAccessLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
