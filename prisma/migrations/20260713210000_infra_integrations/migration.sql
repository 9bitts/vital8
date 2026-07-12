ALTER TABLE "Appointment" ADD COLUMN "googleCalendarEventId" TEXT;

CREATE TABLE "ProfessionalCalendarLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "refreshTokenEncrypted" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalCalendarLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfessionalCalendarLink_professionalId_key" ON "ProfessionalCalendarLink"("professionalId");
CREATE INDEX "ProfessionalCalendarLink_organizationId_idx" ON "ProfessionalCalendarLink"("organizationId");

ALTER TABLE "ProfessionalCalendarLink" ADD CONSTRAINT "ProfessionalCalendarLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalCalendarLink" ADD CONSTRAINT "ProfessionalCalendarLink_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
