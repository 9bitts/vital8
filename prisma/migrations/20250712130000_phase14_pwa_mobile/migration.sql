-- Phase 14: PWA Mobile + Offline

ALTER TABLE "Appointment" ADD COLUMN "offlineProvisional" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "UserNotificationPreference" ADD COLUMN "pushEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserNotificationPreference" ADD COLUMN "pushCategories" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "MobileSyncLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "actionsApplied" INTEGER NOT NULL DEFAULT 0,
    "actionsRejected" INTEGER NOT NULL DEFAULT 0,
    "actionsPending" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MobileSyncLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MobileIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MobileIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE UNIQUE INDEX "MobileIdempotencyRecord_userId_idempotencyKey_key" ON "MobileIdempotencyRecord"("userId", "idempotencyKey");
CREATE INDEX "MobileSyncLog_organizationId_createdAt_idx" ON "MobileSyncLog"("organizationId", "createdAt");
CREATE INDEX "MobileSyncLog_userId_idx" ON "MobileSyncLog"("userId");
CREATE INDEX "MobileIdempotencyRecord_expiresAt_idx" ON "MobileIdempotencyRecord"("expiresAt");
CREATE INDEX "PushSubscription_organizationId_userId_idx" ON "PushSubscription"("organizationId", "userId");

ALTER TABLE "MobileSyncLog" ADD CONSTRAINT "MobileSyncLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MobileSyncLog" ADD CONSTRAINT "MobileSyncLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MobileIdempotencyRecord" ADD CONSTRAINT "MobileIdempotencyRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MobileIdempotencyRecord" ADD CONSTRAINT "MobileIdempotencyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
