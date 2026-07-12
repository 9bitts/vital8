-- Fase 9: BI e métricas agregadas

CREATE TYPE "GoalType" AS ENUM ('REVENUE', 'APPOINTMENTS', 'NEW_PATIENTS', 'NPS');
CREATE TYPE "NotificationType" AS ENUM ('STOCK_LOW', 'STOCK_EXPIRY', 'GLOSA_RECEIVED', 'NPS_DETRACTOR', 'GOAL_PROGRESS', 'CASH_REGISTER_OPEN', 'TISS_BATCH_STALE', 'RECEIVABLE_DUE', 'SYSTEM');

CREATE TABLE "DailyOrgMetrics" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "appointmentsCompleted" INTEGER NOT NULL DEFAULT 0,
    "appointmentsNoShow" INTEGER NOT NULL DEFAULT 0,
    "appointmentsCancelled" INTEGER NOT NULL DEFAULT 0,
    "appointmentsScheduled" INTEGER NOT NULL DEFAULT 0,
    "appointmentsConfirmed" INTEGER NOT NULL DEFAULT 0,
    "slotsAvailable" INTEGER NOT NULL DEFAULT 0,
    "slotsOccupied" INTEGER NOT NULL DEFAULT 0,
    "avgWaitMinutes" DOUBLE PRECISION,
    "avgEncounterMinutes" DOUBLE PRECISION,
    "originRecepcao" INTEGER NOT NULL DEFAULT 0,
    "originTelefone" INTEGER NOT NULL DEFAULT 0,
    "originOnline" INTEGER NOT NULL DEFAULT 0,
    "newPatients" INTEGER NOT NULL DEFAULT 0,
    "npsAvg" DOUBLE PRECISION,
    "npsCount" INTEGER NOT NULL DEFAULT 0,
    "revenueReceivedCents" INTEGER NOT NULL DEFAULT 0,
    "revenueBilledCents" INTEGER NOT NULL DEFAULT 0,
    "expensesCents" INTEGER NOT NULL DEFAULT 0,
    "discountsCents" INTEGER NOT NULL DEFAULT 0,
    "overdueCents" INTEGER NOT NULL DEFAULT 0,
    "tissBilledCents" INTEGER NOT NULL DEFAULT 0,
    "tissReceivedCents" INTEGER NOT NULL DEFAULT 0,
    "glosaCents" INTEGER NOT NULL DEFAULT 0,
    "glosaRecoveredCents" INTEGER NOT NULL DEFAULT 0,
    "inventoryValueCents" INTEGER NOT NULL DEFAULT 0,
    "inventoryLossCents" INTEGER NOT NULL DEFAULT 0,
    "criticalStockCount" INTEGER NOT NULL DEFAULT 0,
    "paymentByMethod" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyOrgMetrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyProfessionalMetrics" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "appointmentsCompleted" INTEGER NOT NULL DEFAULT 0,
    "appointmentsNoShow" INTEGER NOT NULL DEFAULT 0,
    "appointmentsCancelled" INTEGER NOT NULL DEFAULT 0,
    "slotsAvailable" INTEGER NOT NULL DEFAULT 0,
    "slotsOccupied" INTEGER NOT NULL DEFAULT 0,
    "avgWaitMinutes" DOUBLE PRECISION,
    "avgEncounterMinutes" DOUBLE PRECISION,
    "npsAvg" DOUBLE PRECISION,
    "npsCount" INTEGER NOT NULL DEFAULT 0,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "commissionCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyProfessionalMetrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerformanceGoal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "professionalId" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "goalType" "GoalType" NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PerformanceGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserNotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "categories" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserReportPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportKey" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserReportPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduledReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportKey" TEXT NOT NULL,
    "cronDayOfWeek" INTEGER NOT NULL,
    "cronHour" INTEGER NOT NULL DEFAULT 7,
    "recipientRole" "Role",
    "recipientUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduledReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyOrgMetrics_organizationId_date_key" ON "DailyOrgMetrics"("organizationId", "date");
CREATE INDEX "DailyOrgMetrics_organizationId_date_idx" ON "DailyOrgMetrics"("organizationId", "date");

CREATE UNIQUE INDEX "DailyProfessionalMetrics_organizationId_professionalId_date_key" ON "DailyProfessionalMetrics"("organizationId", "professionalId", "date");
CREATE INDEX "DailyProfessionalMetrics_organizationId_date_idx" ON "DailyProfessionalMetrics"("organizationId", "date");
CREATE INDEX "DailyProfessionalMetrics_professionalId_date_idx" ON "DailyProfessionalMetrics"("professionalId", "date");

CREATE UNIQUE INDEX "PerformanceGoal_organizationId_professionalId_year_month_goalType_key" ON "PerformanceGoal"("organizationId", "professionalId", "year", "month", "goalType");
CREATE INDEX "PerformanceGoal_organizationId_year_month_idx" ON "PerformanceGoal"("organizationId", "year", "month");

CREATE INDEX "UserNotification_organizationId_userId_readAt_idx" ON "UserNotification"("organizationId", "userId", "readAt");
CREATE INDEX "UserNotification_userId_createdAt_idx" ON "UserNotification"("userId", "createdAt");

CREATE UNIQUE INDEX "UserNotificationPreference_userId_organizationId_key" ON "UserNotificationPreference"("userId", "organizationId");
CREATE UNIQUE INDEX "UserReportPreference_userId_organizationId_reportKey_key" ON "UserReportPreference"("userId", "organizationId", "reportKey");
CREATE INDEX "ScheduledReport_organizationId_idx" ON "ScheduledReport"("organizationId");

ALTER TABLE "DailyOrgMetrics" ADD CONSTRAINT "DailyOrgMetrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyProfessionalMetrics" ADD CONSTRAINT "DailyProfessionalMetrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyProfessionalMetrics" ADD CONSTRAINT "DailyProfessionalMetrics_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PerformanceGoal" ADD CONSTRAINT "PerformanceGoal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PerformanceGoal" ADD CONSTRAINT "PerformanceGoal_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserReportPreference" ADD CONSTRAINT "UserReportPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
