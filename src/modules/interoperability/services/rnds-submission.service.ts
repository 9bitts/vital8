import type { TenantClient } from "@/lib/db/tenant-client";
import { adminPrisma } from "@/lib/db/admin-client";
import type { RndsRegistrationType } from "@/generated/prisma/client";
import { buildExamResultBundle, buildRacBundleFromEncounter } from "@/modules/fhir/services/rac-bundle.service";
import { getRndsAdapter, getRndsToken, translateOperationOutcome } from "@/lib/integrations/rnds";

export async function enqueueRndsSubmission(
  db: TenantClient,
  organizationId: string,
  input: {
    registrationType: RndsRegistrationType;
    sourceType: "ENCOUNTER" | "EXAM_RESULT";
    sourceId: string;
  },
) {
  const credential = await db.rndsCredential.findFirst({
    where: { organizationId, credentialStatus: { in: ["HOMOLOGACAO", "PRODUCAO"] } },
    orderBy: { updatedAt: "desc" },
  });
  if (!credential) {
    throw new Error("Credencial RNDS não configurada");
  }

  const bundle =
    input.registrationType === "RAC"
      ? await buildRacBundleFromEncounter(db, organizationId, input.sourceId)
      : await buildExamResultBundle(db, organizationId, input.sourceId);

  return db.rndsSubmission.create({
    data: {
      organizationId,
      credentialId: credential.id,
      registrationType: input.registrationType,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      bundleJson: bundle as object,
      status: "FILA",
    },
  });
}

export async function processRndsSubmissions(limit = 50) {
  const now = new Date();
  const pending = await adminPrisma.rndsSubmission.findMany({
    where: {
      status: { in: ["FILA", "ERRO"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    take: limit,
    orderBy: { createdAt: "asc" },
    include: { credential: true },
  });

  const adapter = getRndsAdapter();
  let processed = 0;
  let failed = 0;

  for (const submission of pending) {
    try {
      const token = await getRndsToken(adapter, {
        environment: submission.credential.environment,
        requesterId: submission.credential.requesterId,
        certificateEncrypted: submission.credential.certificateEncrypted,
        certificateReference: submission.credential.certificateReference,
      });

      const result = await adapter.submitBundle(
        {
          environment: submission.credential.environment,
          requesterId: submission.credential.requesterId,
          certificateEncrypted: submission.credential.certificateEncrypted,
          certificateReference: submission.credential.certificateReference,
        },
        token,
        submission.bundleJson as Record<string, unknown>,
        submission.registrationType,
      );

      await adminPrisma.rndsSubmission.update({
        where: { id: submission.id },
        data: {
          status: result.status,
          protocol: result.protocol,
          responseJson: result.response as object,
          attemptCount: submission.attemptCount + 1,
          lastAttemptAt: new Date(),
          errorMessage:
            result.status === "REJEITADO"
              ? translateOperationOutcome(result.response).join("; ")
              : null,
        },
      });
      processed++;
    } catch (err) {
      const attempts = submission.attemptCount + 1;
      const backoffMinutes = [1, 5, 15, 60, 240][Math.min(attempts - 1, 4)];
      const nextRetry = new Date();
      nextRetry.setMinutes(nextRetry.getMinutes() + backoffMinutes);

      await adminPrisma.rndsSubmission.update({
        where: { id: submission.id },
        data: {
          status: attempts >= 5 ? "DLQ" : "ERRO",
          attemptCount: attempts,
          lastAttemptAt: new Date(),
          nextRetryAt: attempts >= 5 ? null : nextRetry,
          errorMessage: err instanceof Error ? err.message : "Erro desconhecido",
        },
      });
      failed++;
    }
  }

  return { processed, failed, total: pending.length };
}

export async function retryRndsSubmission(
  db: TenantClient,
  organizationId: string,
  submissionId: string,
) {
  const submission = await db.rndsSubmission.findFirstOrThrow({
    where: { id: submissionId, organizationId },
  });

  if (!["REJEITADO", "ERRO", "DLQ"].includes(submission.status)) {
    throw new Error("Submissão não pode ser reenviada neste status");
  }

  return db.rndsSubmission.update({
    where: { id: submissionId },
    data: {
      status: "FILA",
      attemptCount: 0,
      nextRetryAt: null,
      errorMessage: null,
    },
  });
}

export async function listRndsSubmissions(
  db: TenantClient,
  organizationId: string,
  filters?: { status?: string; registrationType?: string },
) {
  return db.rndsSubmission.findMany({
    where: {
      organizationId,
      ...(filters?.status ? { status: filters.status as never } : {}),
      ...(filters?.registrationType
        ? { registrationType: filters.registrationType as never }
        : {}),
    },
    include: {
      credential: { select: { environment: true, requesterId: true, credentialStatus: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getOrCreateInteropSettings(db: TenantClient, organizationId: string) {
  const existing = await db.interoperabilitySettings.findUnique({
    where: { organizationId },
  });
  if (existing) return existing;
  return db.interoperabilitySettings.create({
    data: { organizationId },
  });
}

export async function updateInteropSettings(
  db: TenantClient,
  organizationId: string,
  data: Partial<{
    autoSendRac: boolean;
    autoSendExamResults: boolean;
    examResultDeadlineHours: number;
    labIntegrationEnabled: boolean;
    labPollingEnabled: boolean;
    labPollingIntervalMinutes: number;
  }>,
) {
  await getOrCreateInteropSettings(db, organizationId);
  return db.interoperabilitySettings.update({
    where: { organizationId },
    data,
  });
}

export async function scanPendingRndsSubmissions(organizationId: string) {
  const settings = await adminPrisma.interoperabilitySettings.findUnique({
    where: { organizationId },
  });
  if (!settings) return { enqueued: 0 };

  const db = (await import("@/lib/db/tenant-client")).createTenantClient(organizationId);
  let enqueued = 0;

  if (settings.autoSendRac) {
    const signedWithoutSubmission = await db.encounter.findMany({
      where: {
        status: "ASSINADO",
        signedAt: { not: null },
      },
      take: 20,
    });
    for (const enc of signedWithoutSubmission) {
      const existing = await db.rndsSubmission.findFirst({
        where: { sourceType: "ENCOUNTER", sourceId: enc.id },
      });
      if (!existing) {
        await enqueueRndsSubmission(db, organizationId, {
          registrationType: "RAC",
          sourceType: "ENCOUNTER",
          sourceId: enc.id,
        });
        enqueued++;
      }
    }
  }

  if (settings.autoSendExamResults) {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() - settings.examResultDeadlineHours);

    const results = await db.examResult.findMany({
      where: { resultedAt: { gte: deadline } },
      take: 20,
    });
    for (const result of results) {
      const existing = await db.rndsSubmission.findFirst({
        where: { sourceType: "EXAM_RESULT", sourceId: result.id },
      });
      if (!existing) {
        await enqueueRndsSubmission(db, organizationId, {
          registrationType: "EXAM_RESULT",
          sourceType: "EXAM_RESULT",
          sourceId: result.id,
        });
        enqueued++;
      }
    }
  }

  return { enqueued };
}
