import type { TenantClient } from "@/lib/db/tenant-client";
import { encryptPHI } from "@/lib/crypto/phi";
import type { RndsCertificateType, RndsCredentialStatus, RndsEnvironment } from "@/generated/prisma/client";
import { getRndsAdapter } from "@/lib/integrations/rnds";

export async function upsertRndsCredential(
  db: TenantClient,
  organizationId: string,
  input: {
    branchId?: string | null;
    certificateType: RndsCertificateType;
    certificateBase64?: string | null;
    certificateReference?: string | null;
    requesterId: string;
    environment: RndsEnvironment;
    credentialStatus?: RndsCredentialStatus;
  },
) {
  const certificateEncrypted = input.certificateBase64
    ? encryptPHI(input.certificateBase64)
    : null;

  const existing = await db.rndsCredential.findFirst({
    where: { organizationId, branchId: input.branchId ?? null },
  });

  if (existing) {
    return db.rndsCredential.update({
      where: { id: existing.id },
      data: {
        certificateType: input.certificateType,
        certificateEncrypted: certificateEncrypted ?? existing.certificateEncrypted,
        certificateReference: input.certificateReference ?? existing.certificateReference,
        requesterId: input.requesterId,
        environment: input.environment,
        credentialStatus: input.credentialStatus ?? existing.credentialStatus,
      },
    });
  }

  return db.rndsCredential.create({
    data: {
      organizationId,
      branchId: input.branchId ?? null,
      certificateType: input.certificateType,
      certificateEncrypted,
      certificateReference: input.certificateReference ?? null,
      requesterId: input.requesterId,
      environment: input.environment,
      credentialStatus: input.credentialStatus ?? "PENDENTE",
    },
  });
}

export async function testRndsConnection(db: TenantClient, organizationId: string, credentialId: string) {
  const credential = await db.rndsCredential.findFirstOrThrow({
    where: { id: credentialId, organizationId },
  });

  const adapter = getRndsAdapter();
  const result = await adapter.testConnection({
    environment: credential.environment,
    requesterId: credential.requesterId,
    certificateEncrypted: credential.certificateEncrypted,
    certificateReference: credential.certificateReference,
  });

  await db.rndsCredential.update({
    where: { id: credentialId },
    data: {
      lastConnectionTestAt: new Date(),
      lastConnectionOk: result.ok,
    },
  });

  return result;
}

export async function listRndsCredentials(db: TenantClient, organizationId: string) {
  return db.rndsCredential.findMany({
    where: { organizationId },
    include: { branch: { select: { id: true, name: true, cnes: true } } },
    orderBy: { createdAt: "desc" },
  });
}
