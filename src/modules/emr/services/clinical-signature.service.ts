import { createHash, randomBytes } from "crypto";
import type { Prisma, SignedEntityType } from "@/generated/prisma/client";
import type { TenantClient } from "@/lib/db/tenant-client";
import {
  getDigitalSignatureAdapter,
  isLacunaProvider,
  startLacunaClinicalSign,
} from "@/lib/integrations/digital-signature";
import type { LacunaRedirectOutcome } from "@/lib/integrations/digital-signature";
import { embedPadesSignatureBlock } from "@/lib/integrations/digital-signature/pades";
import { getStorageAdapter } from "@/lib/integrations/storage";
import { createAuditLog } from "@/modules/core/services/audit.service";
import {
  decryptSignatureSecrets,
  getOrCreateSignatureSettings,
} from "./signature-settings.service";

export function generateVerificationCode(): string {
  return `V8-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function computeDocumentContentHash(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export type SignClinicalInput = {
  db: TenantClient;
  organizationId: string;
  userId: string;
  userName: string;
  entityType: SignedEntityType;
  entityId: string;
  canonicalContent: string;
  pdfBuffer: Buffer;
  auditMeta?: Record<string, unknown>;
};

export type ClinicalSignOutcome =
  | {
      kind: "completed";
      record: Awaited<ReturnType<typeof persistSignedDocument>>;
      contentHash: string;
      signature: { signedAt: Date; metadata: Record<string, string>; method: string };
      verificationCode: string;
    }
  | LacunaRedirectOutcome;

async function persistSignedDocument(
  input: SignClinicalInput,
  contentHash: string,
  verificationCode: string,
  signature: {
    signedAt: Date;
    metadata: Record<string, string>;
    method: string;
    timestampToken?: string;
    padesBlock?: string;
  },
  signedPdf: Buffer,
  settingsProvider: string,
  timestampToken: string | null,
) {
  const storage = getStorageAdapter();
  const stored = await storage.upload(
    input.organizationId,
    input.entityId,
    `signed-${input.entityType.toLowerCase()}-${verificationCode}.pdf`,
    "application/pdf",
    signedPdf,
  );

  return input.db.signedClinicalDocument.upsert({
    where: {
      organizationId_entityType_entityId: {
        organizationId: input.organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    },
    create: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      verificationCode,
      contentHash,
      signatureMethod: settingsProvider as "DEV_SIMPLE" | "ICP_A1" | "ICP_DSAS" | "ICP_LACUNA",
      signatureMeta: signature.metadata as Prisma.InputJsonValue,
      timestampToken,
      pdfStorageKey: stored.storageKey,
      signerUserId: input.userId,
      signerName: input.userName,
      signedAt: signature.signedAt,
    },
    update: {
      verificationCode,
      contentHash,
      signatureMethod: settingsProvider as "DEV_SIMPLE" | "ICP_A1" | "ICP_DSAS" | "ICP_LACUNA",
      signatureMeta: signature.metadata as Prisma.InputJsonValue,
      timestampToken,
      pdfStorageKey: stored.storageKey,
      signerUserId: input.userId,
      signerName: input.userName,
      signedAt: signature.signedAt,
    },
  });
}

export async function signClinicalDocument(
  input: SignClinicalInput,
): Promise<ClinicalSignOutcome> {
  const settings = await getOrCreateSignatureSettings(input.db, input.organizationId);

  if (isLacunaProvider(settings.provider)) {
    return startLacunaClinicalSign({
      ...input,
      auditMeta: {
        ...input.auditMeta,
        returnPath:
          input.auditMeta?.returnPath ??
          (input.entityType === "ENCOUNTER"
            ? `/app/atendimento/${input.entityId}`
            : undefined),
      },
    });
  }

  const secrets = decryptSignatureSecrets(settings);
  const adapter = getDigitalSignatureAdapter(settings.provider);

  const contentHash = computeDocumentContentHash(input.canonicalContent);
  const verificationCode = generateVerificationCode();
  const timestamp = new Date();

  const signature = await adapter.sign({
    userId: input.userId,
    userName: input.userName,
    contentHash,
    entityType: input.entityType,
    entityId: input.entityId,
    timestamp,
    certificatePfxBase64: secrets.certificatePfxBase64 ?? undefined,
    certificatePassword: secrets.certificatePassword ?? undefined,
    dsasApiUrl: settings.dsasApiUrl ?? undefined,
    dsasApiKey: secrets.dsasApiKey ?? undefined,
  });

  let timestampToken: string | null = signature.timestampToken ?? null;
  if (settings.timestampEnabled && !timestampToken && adapter.requestTimestamp) {
    timestampToken = await adapter.requestTimestamp(contentHash);
  }

  const signedPdf = embedPadesSignatureBlock(input.pdfBuffer, {
    verificationCode,
    contentHash,
    signerName: input.userName,
    signedAt: signature.signedAt,
    method: signature.method,
    timestampToken,
    padesBlock: signature.padesBlock,
  });

  const record = await persistSignedDocument(
    input,
    contentHash,
    verificationCode,
    signature,
    signedPdf,
    settings.provider,
    timestampToken,
  );

  await createAuditLog({
    action: "clinical.sign",
    userId: input.userId,
    organizationId: input.organizationId,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: {
      contentHash,
      verificationCode,
      signatureMethod: settings.provider,
      ...input.auditMeta,
    } as Prisma.InputJsonValue,
  });

  return {
    kind: "completed" as const,
    record,
    contentHash,
    signature,
    verificationCode,
  };
}

export const ENTITY_TYPE_LABELS: Record<SignedEntityType, string> = {
  ENCOUNTER: "Prontuário (encontro clínico)",
  PRESCRIPTION: "Receituário",
  MEDICAL_CERTIFICATE: "Atestado / documento médico",
  EXAM_RESULT: "Laudo de exame",
};
