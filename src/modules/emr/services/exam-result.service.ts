import type { TenantClient } from "@/lib/db/tenant-client";
import { encryptPHI } from "@/lib/crypto/phi";
import { getStorageAdapter } from "@/lib/integrations/storage";
import { signClinicalDocument } from "./clinical-signature.service";
import { generateExamResultPdf } from "./pdf.service";
import { logRecordAccess } from "./record-access.service";
import { assertEncounterMutable } from "./encounter.service";

export async function createExamResult(
  db: TenantClient,
  organizationId: string,
  userId: string,
  userName: string,
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
    include: { patient: true, professional: true },
  });
  assertEncounterMutable(encounter.status);

  let storageKey: string | null = null;
  let uploadedPdf: Buffer | null = null;
  if (input.fileBase64 && input.fileName && input.mimeType) {
    const buffer = Buffer.from(input.fileBase64, "base64");
    uploadedPdf = buffer;
    const stored = await getStorageAdapter().upload(
      organizationId,
      encounter.patientId,
      input.fileName,
      input.mimeType,
      buffer,
    );
    storageKey = stored.storageKey;
  }

  const result = await db.examResult.create({
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

  const org = await db.organization.findFirstOrThrow({ where: { id: organizationId } });
  const pdfBuffer =
    uploadedPdf ??
    generateExamResultPdf({
      header: {
        orgName: org.name,
        professionalName: encounter.professional.displayName,
        council: encounter.professional.councilType ?? undefined,
        councilNumber: encounter.professional.councilNumber ?? undefined,
        councilState: encounter.professional.councilState ?? undefined,
      },
      patientName: encounter.patient.socialName ?? encounter.patient.fullName,
      fileName: input.fileName,
      values: result.values,
      notes: input.notes ?? null,
      date: new Date(),
    });

  await signClinicalDocument({
    db,
    organizationId,
    userId,
    userName,
    entityType: "EXAM_RESULT",
    entityId: result.id,
    canonicalContent: JSON.stringify({
      resultId: result.id,
      fileName: input.fileName,
      values: result.values,
      notes: input.notes ?? null,
    }),
    pdfBuffer,
  });

  return result;
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
