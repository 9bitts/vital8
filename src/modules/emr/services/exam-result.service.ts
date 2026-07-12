import type { TenantClient } from "@/lib/db/tenant-client";
import { encryptPHI } from "@/lib/crypto/phi";
import { getStorageAdapter } from "@/lib/integrations/storage";
import { logRecordAccess } from "./record-access.service";
import { assertEncounterMutable } from "./encounter.service";

export async function createExamResult(
  db: TenantClient,
  organizationId: string,
  userId: string,
  input: {
    encounterId: string;
    requestId?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    fileBase64?: string | null;
    notes?: string | null;
    values?: Array<{
      name: string;
      value: string;
      unit?: string | null;
      referenceRange?: string | null;
    }>;
  },
) {
  const encounter = await db.encounter.findFirstOrThrow({
    where: { id: input.encounterId },
  });
  assertEncounterMutable(encounter.status);

  let storageKey: string | null = null;
  if (input.fileBase64 && input.fileName && input.mimeType) {
    const buffer = Buffer.from(input.fileBase64, "base64");
    const stored = await getStorageAdapter().upload(
      organizationId,
      encounter.patientId,
      input.fileName,
      input.mimeType,
      buffer,
    );
    storageKey = stored.storageKey;
  }

  return db.examResult.create({
    data: {
      organizationId,
      patientId: encounter.patientId,
      encounterId: input.encounterId,
      requestId: input.requestId ?? null,
      fileName: input.fileName ?? null,
      mimeType: input.mimeType ?? null,
      storageKey,
      notesEncrypted: input.notes ? encryptPHI(input.notes) : null,
      values: input.values?.length
        ? {
            create: input.values.map((v) => ({
              organizationId,
              name: v.name,
              value: v.value,
              unit: v.unit ?? null,
              referenceRange: v.referenceRange ?? null,
            })),
          }
        : undefined,
    },
    include: { values: true },
  });
}

export async function getExamResultFile(
  db: TenantClient,
  organizationId: string,
  resultId: string,
  viewerUserId: string,
  accessMeta?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const result = await db.examResult.findFirstOrThrow({
    where: { id: resultId },
  });

  if (!result.storageKey) {
    throw new Error("Resultado sem anexo");
  }

  await logRecordAccess({
    organizationId,
    userId: viewerUserId,
    resourceType: "EXAM_RESULT",
    resourceId: resultId,
    ipAddress: accessMeta?.ipAddress,
    userAgent: accessMeta?.userAgent,
    metadata: { patientId: result.patientId },
  });

  const buffer = await getStorageAdapter().download(result.storageKey);
  return {
    buffer,
    mimeType: result.mimeType ?? "application/octet-stream",
    fileName: result.fileName ?? "resultado",
  };
}
