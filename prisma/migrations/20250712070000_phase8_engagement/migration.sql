-- Fase 8: Relacionamento, Portal e Telemedicina

CREATE TYPE "OnlineApprovalStatus" AS ENUM ('NAO_APLICAVEL', 'PENDENTE', 'APROVADO', 'REJEITADO');
CREATE TYPE "CommunicationChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');
CREATE TYPE "CommunicationStatus" AS ENUM ('FILA', 'ENVIADO', 'FALHA', 'RESPONDIDO');
CREATE TYPE "CommunicationOrigin" AS ENUM ('CONFIRMACAO', 'COBRANCA', 'ANIVERSARIO', 'NPS', 'CAMPANHA', 'LEMBRETE_RETORNO', 'POS_ATENDIMENTO');
CREATE TYPE "AutomationTriggerEvent" AS ENUM ('APPOINTMENT_CONFIRMATION', 'RETURN_REMINDER', 'BIRTHDAY', 'POST_ENCOUNTER_NPS', 'OVERDUE_COLLECTION');
CREATE TYPE "AutomationOffsetUnit" AS ENUM ('HOURS', 'DAYS');
CREATE TYPE "OptOutPurpose" AS ENUM ('TRANSACIONAL', 'MARKETING');
CREATE TYPE "PortalOtpPurpose" AS ENUM ('BOOKING', 'PORTAL_LOGIN');
CREATE TYPE "ReleasedDocumentType" AS ENUM ('PRESCRIPTION', 'MEDICAL_CERTIFICATE', 'EXAM_RESULT');
CREATE TYPE "CampaignStatus" AS ENUM ('RASCUNHO', 'NA_FILA', 'ENVIADA');
CREATE TYPE "PatientCorrectionStatus" AS ENUM ('PENDENTE', 'RESOLVIDO');

ALTER TYPE "RecordResourceType" ADD VALUE 'PATIENT_PORTAL';

ALTER TABLE "Service" ADD COLUMN "isTeleconsult" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN "onlineApprovalStatus" "OnlineApprovalStatus" NOT NULL DEFAULT 'NAO_APLICAVEL';
ALTER TABLE "Encounter" ADD COLUMN "teleconsultConsentId" TEXT;
ALTER TABLE "Encounter" ADD COLUMN "professionalJoinedAt" TIMESTAMP(3);
ALTER TABLE "Encounter" ADD COLUMN "patientJoinedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Encounter_teleconsultConsentId_key" ON "Encounter"("teleconsultConsentId");

CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerEvent" "AutomationTriggerEvent" NOT NULL,
    "offsetValue" INTEGER NOT NULL,
    "offsetUnit" "AutomationOffsetUnit" NOT NULL DEFAULT 'HOURS',
    "channel" "CommunicationChannel" NOT NULL,
    "templateId" TEXT NOT NULL,
    "serviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "templateId" TEXT,
    "subject" TEXT,
    "renderedBody" TEXT NOT NULL,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'FILA',
    "origin" "CommunicationOrigin" NOT NULL,
    "originRefId" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "failReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "campaignId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatientOptOut" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "channel" "CommunicationChannel",
    "purpose" "OptOutPurpose" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientOptOut_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatientPortalOtp" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT,
    "contactHash" TEXT NOT NULL,
    "contactType" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "purpose" "PortalOtpPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientPortalOtp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatientPortalSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientPortalSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnlineBookingConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledServiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabledProfessionalIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minAdvanceHours" INTEGER NOT NULL DEFAULT 4,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "welcomeText" TEXT,
    "autoReleaseDocuments" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OnlineBookingConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeleconsultConsent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "termVersion" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeleconsultConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeleconsultRoom" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'jitsi',
    "roomUrl" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "professionalJoinedAt" TIMESTAMP(3),
    "patientJoinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeleconsultRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NpsSurvey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "encounterId" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NpsSurvey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NpsResponse" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NpsResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReleasedDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "documentType" "ReleasedDocumentType" NOT NULL,
    "prescriptionId" TEXT,
    "certificateId" TEXT,
    "examResultId" TEXT,
    "releasedByUserId" TEXT,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "autoReleased" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReleasedDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "filter" JSONB NOT NULL DEFAULT '{}',
    "createdByUserId" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'RASCUNHO',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatientDataCorrectionRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "requestedFields" JSONB NOT NULL DEFAULT '{}',
    "message" TEXT,
    "status" "PatientCorrectionStatus" NOT NULL DEFAULT 'PENDENTE',
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientDataCorrectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageTemplate_organizationId_eventKey_channel_key" ON "MessageTemplate"("organizationId", "eventKey", "channel");
CREATE UNIQUE INDEX "CommunicationLog_idempotencyKey_key" ON "CommunicationLog"("idempotencyKey");
CREATE UNIQUE INDEX "PatientOptOut_organizationId_patientId_purpose_channel_key" ON "PatientOptOut"("organizationId", "patientId", "purpose", "channel");
CREATE UNIQUE INDEX "PatientPortalSession_sessionTokenHash_key" ON "PatientPortalSession"("sessionTokenHash");
CREATE UNIQUE INDEX "OnlineBookingConfig_organizationId_key" ON "OnlineBookingConfig"("organizationId");
CREATE UNIQUE INDEX "TeleconsultConsent_appointmentId_key" ON "TeleconsultConsent"("appointmentId");
CREATE UNIQUE INDEX "TeleconsultConsent_token_key" ON "TeleconsultConsent"("token");
CREATE UNIQUE INDEX "TeleconsultRoom_encounterId_key" ON "TeleconsultRoom"("encounterId");
CREATE UNIQUE INDEX "NpsSurvey_appointmentId_key" ON "NpsSurvey"("appointmentId");
CREATE UNIQUE INDEX "NpsSurvey_encounterId_key" ON "NpsSurvey"("encounterId");
CREATE UNIQUE INDEX "NpsSurvey_token_key" ON "NpsSurvey"("token");
CREATE UNIQUE INDEX "NpsResponse_surveyId_key" ON "NpsResponse"("surveyId");

CREATE INDEX "MessageTemplate_organizationId_idx" ON "MessageTemplate"("organizationId");
CREATE INDEX "AutomationRule_organizationId_idx" ON "AutomationRule"("organizationId");
CREATE INDEX "AutomationRule_triggerEvent_idx" ON "AutomationRule"("triggerEvent");
CREATE INDEX "CommunicationLog_organizationId_idx" ON "CommunicationLog"("organizationId");
CREATE INDEX "CommunicationLog_patientId_idx" ON "CommunicationLog"("patientId");
CREATE INDEX "CommunicationLog_status_idx" ON "CommunicationLog"("status");
CREATE INDEX "CommunicationLog_scheduledFor_idx" ON "CommunicationLog"("scheduledFor");
CREATE INDEX "CommunicationLog_origin_idx" ON "CommunicationLog"("origin");
CREATE INDEX "PatientOptOut_organizationId_idx" ON "PatientOptOut"("organizationId");
CREATE INDEX "PatientOptOut_patientId_idx" ON "PatientOptOut"("patientId");
CREATE INDEX "PatientPortalOtp_organizationId_idx" ON "PatientPortalOtp"("organizationId");
CREATE INDEX "PatientPortalOtp_contactHash_idx" ON "PatientPortalOtp"("contactHash");
CREATE INDEX "PatientPortalOtp_expiresAt_idx" ON "PatientPortalOtp"("expiresAt");
CREATE INDEX "PatientPortalSession_organizationId_idx" ON "PatientPortalSession"("organizationId");
CREATE INDEX "PatientPortalSession_patientId_idx" ON "PatientPortalSession"("patientId");
CREATE INDEX "PatientPortalSession_expiresAt_idx" ON "PatientPortalSession"("expiresAt");
CREATE INDEX "TeleconsultConsent_organizationId_idx" ON "TeleconsultConsent"("organizationId");
CREATE INDEX "TeleconsultConsent_patientId_idx" ON "TeleconsultConsent"("patientId");
CREATE INDEX "TeleconsultRoom_organizationId_idx" ON "TeleconsultRoom"("organizationId");
CREATE INDEX "NpsSurvey_organizationId_idx" ON "NpsSurvey"("organizationId");
CREATE INDEX "NpsSurvey_patientId_idx" ON "NpsSurvey"("patientId");
CREATE INDEX "NpsResponse_organizationId_idx" ON "NpsResponse"("organizationId");
CREATE INDEX "NpsResponse_score_idx" ON "NpsResponse"("score");
CREATE INDEX "ReleasedDocument_organizationId_idx" ON "ReleasedDocument"("organizationId");
CREATE INDEX "ReleasedDocument_patientId_idx" ON "ReleasedDocument"("patientId");
CREATE INDEX "ReleasedDocument_documentType_idx" ON "ReleasedDocument"("documentType");
CREATE INDEX "Campaign_organizationId_idx" ON "Campaign"("organizationId");
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");
CREATE INDEX "PatientDataCorrectionRequest_organizationId_idx" ON "PatientDataCorrectionRequest"("organizationId");
CREATE INDEX "PatientDataCorrectionRequest_patientId_idx" ON "PatientDataCorrectionRequest"("patientId");
CREATE INDEX "PatientDataCorrectionRequest_status_idx" ON "PatientDataCorrectionRequest"("status");

ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_teleconsultConsentId_fkey" FOREIGN KEY ("teleconsultConsentId") REFERENCES "TeleconsultConsent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PatientOptOut" ADD CONSTRAINT "PatientOptOut_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientOptOut" ADD CONSTRAINT "PatientOptOut_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientPortalOtp" ADD CONSTRAINT "PatientPortalOtp_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientPortalOtp" ADD CONSTRAINT "PatientPortalOtp_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PatientPortalSession" ADD CONSTRAINT "PatientPortalSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientPortalSession" ADD CONSTRAINT "PatientPortalSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnlineBookingConfig" ADD CONSTRAINT "OnlineBookingConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeleconsultConsent" ADD CONSTRAINT "TeleconsultConsent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeleconsultConsent" ADD CONSTRAINT "TeleconsultConsent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeleconsultConsent" ADD CONSTRAINT "TeleconsultConsent_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeleconsultRoom" ADD CONSTRAINT "TeleconsultRoom_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeleconsultRoom" ADD CONSTRAINT "TeleconsultRoom_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NpsSurvey" ADD CONSTRAINT "NpsSurvey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NpsSurvey" ADD CONSTRAINT "NpsSurvey_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NpsSurvey" ADD CONSTRAINT "NpsSurvey_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NpsSurvey" ADD CONSTRAINT "NpsSurvey_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NpsResponse" ADD CONSTRAINT "NpsResponse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NpsResponse" ADD CONSTRAINT "NpsResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "NpsSurvey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReleasedDocument" ADD CONSTRAINT "ReleasedDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReleasedDocument" ADD CONSTRAINT "ReleasedDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientDataCorrectionRequest" ADD CONSTRAINT "PatientDataCorrectionRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientDataCorrectionRequest" ADD CONSTRAINT "PatientDataCorrectionRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
