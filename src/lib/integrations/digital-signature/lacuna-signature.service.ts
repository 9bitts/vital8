import type { Prisma, SignedEntityType } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";
import { getStorageAdapter } from "@/lib/integrations/storage";
import { createAuditLog } from "@/modules/core/services/audit.service";
import { transitionAppointmentStatus } from "@/modules/scheduling/services/appointment.service";
import {
  computeDocumentContentHash,
  generateVerificationCode,
  type SignClinicalInput,
} from "@/modules/emr/services/clinical-signature.service";
import {
  createSignatureSession,
  downloadSignedPdf,
  getSignatureSession,
  getSignedLocation,
} from "./lacuna-client";
import { parseLacunaError, LACUNA_ERROR_MESSAGES } from "./lacuna-errors";

export type LacunaRedirectOutcome = {
  kind: "lacuna_redirect";
  redirectUrl: string;
  sessionId: string;
  verificationCode: string;
  contentHash: string;
};

function buildCallbackUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/api/digital-sign/callback`;
}

export async function startLacunaClinicalSign(
  input: SignClinicalInput,
): Promise<LacunaRedirectOutcome> {
  const contentHash = computeDocumentContentHash(input.canonicalContent);
  const verificationCode = generateVerificationCode();
  const fileName = `vital8-${input.entityType.toLowerCase()}-${input.entityId}.pdf`;

  let lacuna;
  try {
    lacuna = await createSignatureSession({
      pdfBytes: input.pdfBuffer,
      fileName,
      returnUrl: buildCallbackUrl(),
      cpf: null,
    });
  } catch (e) {
    const code = parseLacunaError(e);
    throw new Error(LACUNA_ERROR_MESSAGES[code]);
  }

  await adminPrisma.lacunaSignatureSession.create({
    data: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      lacunaSessionId: lacuna.sessionId,
      contentHash,
      verificationCode,
      signerUserId: input.userId,
      signerName: input.userName,
      returnPath: input.auditMeta?.returnPath as string | undefined,
    },
  });

  return {
    kind: "lacuna_redirect",
    redirectUrl: lacuna.redirectUrl,
    sessionId: lacuna.sessionId,
    verificationCode,
    contentHash,
  };
}

async function finalizeEncounter(
  db: ReturnType<typeof createTenantClient>,
  organizationId: string,
  userId: string,
  entityId: string,
  contentHash: string,
  verificationCode: string,
  signedAt: Date,
) {
  const encounter = await db.encounter.findFirstOrThrow({
    where: { id: entityId, organizationId },
  });

  await db.encounter.update({
    where: { id: entityId },
    data: {
      status: "ASSINADO",
      contentHash,
      signedAt,
      endedAt: new Date(),
      signatureMeta: {
        verificationCode,
        lacuna: true,
      },
    },
  });

  if (encounter.appointmentId) {
    await transitionAppointmentStatus(
      db,
      organizationId,
      userId,
      encounter.appointmentId,
      "FINALIZADO",
    );
  }
}

export async function completeLacunaClinicalSign(
  lacunaSessionId: string,
): Promise<{ status: "success" | "cancelled" | "processing" | "error"; returnPath?: string }> {
  const pending = await adminPrisma.lacunaSignatureSession.findFirst({
    where: { lacunaSessionId },
  });

  if (!pending) {
    return { status: "error" };
  }

  if (pending.status === "COMPLETED") {
    return { status: "success", returnPath: pending.returnPath ?? undefined };
  }

  let lacunaSession;
  try {
    lacunaSession = await getSignatureSession(lacunaSessionId);
  } catch {
    await adminPrisma.lacunaSignatureSession.update({
      where: { id: pending.id },
      data: { status: "ERROR" },
    });
    return { status: "error", returnPath: pending.returnPath ?? undefined };
  }

  const status = (lacunaSession.status || "").toLowerCase();

  if (status === "usercancelled" || status === "cancelled") {
    await adminPrisma.lacunaSignatureSession.update({
      where: { id: pending.id },
      data: { status: "CANCELLED" },
    });
    return { status: "cancelled", returnPath: pending.returnPath ?? undefined };
  }

  if (status === "processing" || status === "pending") {
    await adminPrisma.lacunaSignatureSession.update({
      where: { id: pending.id },
      data: { status: "PROCESSING" },
    });
    return { status: "processing", returnPath: pending.returnPath ?? undefined };
  }

  if (status !== "completed") {
    await adminPrisma.lacunaSignatureSession.update({
      where: { id: pending.id },
      data: { status: "ERROR" },
    });
    return { status: "error", returnPath: pending.returnPath ?? undefined };
  }

  const location = getSignedLocation(lacunaSession);
  if (!location) {
    await adminPrisma.lacunaSignatureSession.update({
      where: { id: pending.id },
      data: { status: "ERROR" },
    });
    return { status: "error", returnPath: pending.returnPath ?? undefined };
  }

  let signedPdf: Buffer;
  try {
    signedPdf = await downloadSignedPdf(location);
  } catch {
    await adminPrisma.lacunaSignatureSession.update({
      where: { id: pending.id },
      data: { status: "ERROR" },
    });
    return { status: "error", returnPath: pending.returnPath ?? undefined };
  }

  const storage = getStorageAdapter();
  const stored = await storage.upload(
    pending.organizationId,
    pending.entityId,
    `signed-lacuna-${pending.entityType.toLowerCase()}-${pending.verificationCode}.pdf`,
    "application/pdf",
    signedPdf,
  );

  const signedAt = new Date();
  const db = createTenantClient(pending.organizationId);

  await db.signedClinicalDocument.upsert({
    where: {
      organizationId_entityType_entityId: {
        organizationId: pending.organizationId,
        entityType: pending.entityType,
        entityId: pending.entityId,
      },
    },
    create: {
      organizationId: pending.organizationId,
      entityType: pending.entityType,
      entityId: pending.entityId,
      verificationCode: pending.verificationCode,
      contentHash: pending.contentHash,
      signatureMethod: "ICP_LACUNA",
      signatureMeta: {
        lacunaSessionId,
        provider: "lacuna",
      } as Prisma.InputJsonValue,
      pdfStorageKey: stored.storageKey,
      signerUserId: pending.signerUserId,
      signerName: pending.signerName,
      signedAt,
    },
    update: {
      verificationCode: pending.verificationCode,
      contentHash: pending.contentHash,
      signatureMethod: "ICP_LACUNA",
      signatureMeta: {
        lacunaSessionId,
        provider: "lacuna",
      } as Prisma.InputJsonValue,
      pdfStorageKey: stored.storageKey,
      signerUserId: pending.signerUserId,
      signerName: pending.signerName,
      signedAt,
    },
  });

  if (pending.entityType === "ENCOUNTER") {
    await finalizeEncounter(
      db,
      pending.organizationId,
      pending.signerUserId,
      pending.entityId,
      pending.contentHash,
      pending.verificationCode,
      signedAt,
    );
  }

  if (pending.entityType === "PRESCRIPTION") {
    const prescription = await db.prescription.findFirstOrThrow({
      where: { id: pending.entityId, organizationId: pending.organizationId },
      include: { encounter: { select: { patientId: true } } },
    });
    const { releaseDocument } = await import(
      "@/modules/engagement/services/campaign.service"
    );
    await releaseDocument({
      organizationId: pending.organizationId,
      patientId: prescription.encounter.patientId,
      documentType: "PRESCRIPTION",
      prescriptionId: prescription.id,
      releasedByUserId: pending.signerUserId,
      autoReleased: true,
    });
  }

  await createAuditLog({
    action: "clinical.sign",
    userId: pending.signerUserId,
    organizationId: pending.organizationId,
    entityType: pending.entityType,
    entityId: pending.entityId,
    metadata: {
      contentHash: pending.contentHash,
      verificationCode: pending.verificationCode,
      signatureMethod: "ICP_LACUNA",
      lacunaSessionId,
    } as Prisma.InputJsonValue,
  });

  await adminPrisma.lacunaSignatureSession.update({
    where: { id: pending.id },
    data: { status: "COMPLETED", completedAt: signedAt },
  });

  return { status: "success", returnPath: pending.returnPath ?? undefined };
}

export function defaultReturnPath(entityType: SignedEntityType, entityId: string): string {
  switch (entityType) {
    case "ENCOUNTER":
      return `/app/atendimento/${entityId}`;
    case "PRESCRIPTION":
      return `/app/atendimento`;
    case "MEDICAL_CERTIFICATE":
      return `/app/atendimento`;
    default:
      return "/app";
  }
}
