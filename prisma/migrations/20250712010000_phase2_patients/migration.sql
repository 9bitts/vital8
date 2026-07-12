-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MASCULINO', 'FEMININO', 'INTERSEX', 'NAO_INFORMADO');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SOLTEIRO', 'CASADO', 'DIVORCIADO', 'VIUVO', 'UNIAO_ESTAVEL', 'OUTRO', 'NAO_INFORMADO');

-- CreateEnum
CREATE TYPE "ConsentChannel" AS ENUM ('PRESENCIAL', 'DIGITAL', 'TELEFONE', 'IMPORTACAO');

-- CreateEnum
CREATE TYPE "PatientDocCategory" AS ENUM ('RG', 'CPF', 'COMPROVANTE_RESIDENCIA', 'CARTEIRINHA_CONVENIO', 'EXAME', 'OUTRO');

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "searchName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "socialName" TEXT,
    "cpfEncrypted" TEXT,
    "cpfHash" TEXT,
    "rgEncrypted" TEXT,
    "birthDate" DATE,
    "sex" "Sex",
    "genderIdentity" TEXT,
    "maritalStatus" "MaritalStatus",
    "profession" TEXT,
    "phonesEncrypted" TEXT,
    "phoneSearch" TEXT,
    "emailEncrypted" TEXT,
    "addressEncrypted" TEXT,
    "photoUrl" TEXT,
    "notesEncrypted" TEXT,
    "referralSource" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isIncomplete" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientGuardian" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "cpfEncrypted" TEXT,
    "phoneEncrypted" TEXT,
    "relationship" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PatientGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientInsurancePlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "insurerName" TEXT NOT NULL,
    "planName" TEXT,
    "cardNumberEncrypted" TEXT NOT NULL,
    "cardNumberSearch" TEXT,
    "validUntil" DATE,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PatientInsurancePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientConsent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "termKey" TEXT NOT NULL,
    "termVersion" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "channel" "ConsentChannel" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PatientConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "category" "PatientDocCategory" NOT NULL DEFAULT 'OUTRO',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PatientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "substance" TEXT NOT NULL,
    "severity" TEXT,
    "notesEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChronicCondition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "cidCode" TEXT,
    "diagnosedAt" DATE,
    "notesEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChronicCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientMedication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "route" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notesEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PatientMedication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Patient_organizationId_searchName_idx" ON "Patient"("organizationId", "searchName");

-- CreateIndex
CREATE INDEX "Patient_organizationId_birthDate_idx" ON "Patient"("organizationId", "birthDate");

-- CreateIndex
CREATE INDEX "Patient_organizationId_phoneSearch_idx" ON "Patient"("organizationId", "phoneSearch");

-- CreateIndex
CREATE INDEX "Patient_deletedAt_idx" ON "Patient"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_organizationId_cpfHash_key" ON "Patient"("organizationId", "cpfHash");

-- CreateIndex
CREATE INDEX "PatientGuardian_organizationId_idx" ON "PatientGuardian"("organizationId");

-- CreateIndex
CREATE INDEX "PatientGuardian_patientId_idx" ON "PatientGuardian"("patientId");

-- CreateIndex
CREATE INDEX "PatientGuardian_deletedAt_idx" ON "PatientGuardian"("deletedAt");

-- CreateIndex
CREATE INDEX "PatientInsurancePlan_organizationId_idx" ON "PatientInsurancePlan"("organizationId");

-- CreateIndex
CREATE INDEX "PatientInsurancePlan_patientId_idx" ON "PatientInsurancePlan"("patientId");

-- CreateIndex
CREATE INDEX "PatientInsurancePlan_organizationId_cardNumberSearch_idx" ON "PatientInsurancePlan"("organizationId", "cardNumberSearch");

-- CreateIndex
CREATE INDEX "PatientInsurancePlan_deletedAt_idx" ON "PatientInsurancePlan"("deletedAt");

-- CreateIndex
CREATE INDEX "PatientConsent_organizationId_idx" ON "PatientConsent"("organizationId");

-- CreateIndex
CREATE INDEX "PatientConsent_patientId_idx" ON "PatientConsent"("patientId");

-- CreateIndex
CREATE INDEX "PatientConsent_deletedAt_idx" ON "PatientConsent"("deletedAt");

-- CreateIndex
CREATE INDEX "PatientDocument_organizationId_idx" ON "PatientDocument"("organizationId");

-- CreateIndex
CREATE INDEX "PatientDocument_patientId_idx" ON "PatientDocument"("patientId");

-- CreateIndex
CREATE INDEX "PatientDocument_deletedAt_idx" ON "PatientDocument"("deletedAt");

-- CreateIndex
CREATE INDEX "Allergy_organizationId_idx" ON "Allergy"("organizationId");

-- CreateIndex
CREATE INDEX "Allergy_patientId_idx" ON "Allergy"("patientId");

-- CreateIndex
CREATE INDEX "Allergy_deletedAt_idx" ON "Allergy"("deletedAt");

-- CreateIndex
CREATE INDEX "ChronicCondition_organizationId_idx" ON "ChronicCondition"("organizationId");

-- CreateIndex
CREATE INDEX "ChronicCondition_patientId_idx" ON "ChronicCondition"("patientId");

-- CreateIndex
CREATE INDEX "ChronicCondition_deletedAt_idx" ON "ChronicCondition"("deletedAt");

-- CreateIndex
CREATE INDEX "PatientMedication_organizationId_idx" ON "PatientMedication"("organizationId");

-- CreateIndex
CREATE INDEX "PatientMedication_patientId_idx" ON "PatientMedication"("patientId");

-- CreateIndex
CREATE INDEX "PatientMedication_deletedAt_idx" ON "PatientMedication"("deletedAt");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientGuardian" ADD CONSTRAINT "PatientGuardian_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurancePlan" ADD CONSTRAINT "PatientInsurancePlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientConsent" ADD CONSTRAINT "PatientConsent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientDocument" ADD CONSTRAINT "PatientDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChronicCondition" ADD CONSTRAINT "ChronicCondition_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMedication" ADD CONSTRAINT "PatientMedication_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
