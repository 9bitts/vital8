CREATE TABLE "WhatsAppDeliveryLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "messageId" TEXT,
    "phone" TEXT,
    "template" TEXT,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppDeliveryLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WhatsAppDeliveryLog_organizationId_idx" ON "WhatsAppDeliveryLog"("organizationId");
CREATE INDEX "WhatsAppDeliveryLog_messageId_idx" ON "WhatsAppDeliveryLog"("messageId");
CREATE INDEX "WhatsAppDeliveryLog_createdAt_idx" ON "WhatsAppDeliveryLog"("createdAt");

ALTER TABLE "WhatsAppDeliveryLog" ADD CONSTRAINT "WhatsAppDeliveryLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
