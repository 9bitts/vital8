CREATE TABLE "DailyRecordingLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "dailyRoomName" TEXT NOT NULL,
    "cloudRecording" BOOLEAN NOT NULL DEFAULT true,
    "recordingId" TEXT,
    "downloadUrl" TEXT,
    "durationSecs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "readyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyRecordingLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeleconsultVideoIncident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "reportedByUserId" TEXT,
    "kind" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeleconsultVideoIncident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DailyRecordingLog_organizationId_idx" ON "DailyRecordingLog"("organizationId");
CREATE INDEX "DailyRecordingLog_encounterId_idx" ON "DailyRecordingLog"("encounterId");
CREATE INDEX "DailyRecordingLog_dailyRoomName_idx" ON "DailyRecordingLog"("dailyRoomName");
CREATE INDEX "DailyRecordingLog_createdAt_idx" ON "DailyRecordingLog"("createdAt");

CREATE INDEX "TeleconsultVideoIncident_organizationId_idx" ON "TeleconsultVideoIncident"("organizationId");
CREATE INDEX "TeleconsultVideoIncident_encounterId_idx" ON "TeleconsultVideoIncident"("encounterId");
CREATE INDEX "TeleconsultVideoIncident_patientId_createdAt_idx" ON "TeleconsultVideoIncident"("patientId", "createdAt");

ALTER TABLE "DailyRecordingLog" ADD CONSTRAINT "DailyRecordingLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyRecordingLog" ADD CONSTRAINT "DailyRecordingLog_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeleconsultVideoIncident" ADD CONSTRAINT "TeleconsultVideoIncident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeleconsultVideoIncident" ADD CONSTRAINT "TeleconsultVideoIncident_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
