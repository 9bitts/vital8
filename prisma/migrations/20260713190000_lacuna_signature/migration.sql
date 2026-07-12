CREATE TYPE "LacunaSessionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'ERROR');

ALTER TYPE "SignatureProvider" ADD VALUE 'ICP_LACUNA';

CREATE TABLE "LacunaSignatureSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" "SignedEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "lacunaSessionId" TEXT NOT NULL,
    "status" "LacunaSessionStatus" NOT NULL DEFAULT 'PENDING',
    "contentHash" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "signerUserId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "returnPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LacunaSignatureSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LacunaSignatureSession_lacunaSessionId_key" ON "LacunaSignatureSession"("lacunaSessionId");
CREATE INDEX "LacunaSignatureSession_organizationId_idx" ON "LacunaSignatureSession"("organizationId");
CREATE INDEX "LacunaSignatureSession_entityType_entityId_idx" ON "LacunaSignatureSession"("entityType", "entityId");
CREATE INDEX "LacunaSignatureSession_status_idx" ON "LacunaSignatureSession"("status");

ALTER TABLE "LacunaSignatureSession" ADD CONSTRAINT "LacunaSignatureSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
