import type { TenantClient } from "@/lib/db/tenant-client";
import { adminPrisma } from "@/lib/db/admin-client";
import { createNotification } from "@/modules/analytics/services/notification.service";
import { releaseDocument } from "@/modules/engagement/services/campaign.service";
import { observationFromFhir } from "@/modules/fhir/mappers/observation.mapper";
import { isOutOfReference } from "@/modules/fhir/mappers/observation.mapper";
import type { LabResultPayload } from "@/lib/integrations/lab-integration";
import { getLabIntegrationAdapter } from "@/lib/integrations/lab-integration";

export type ReconciliationResult =
  | { status: "CONCILIADO"; resultId: string; requestId: string }
  | { status: "PENDENTE"; reconciliationId: string; reason: string };

function extractRequestId(payload: LabResultPayload): string | null {
  const ref = payload.diagnosticReport.basedOn?.[0]?.reference;
  if (!ref) return payload.externalRequestId ?? null;
  const parts = ref.split("/");
  return parts[parts.length - 1] ?? null;
}

export async function reconcileLabResult(
  db: TenantClient,
  organizationId: string,
  payload: LabResultPayload,
): Promise<ReconciliationResult> {
  const requestId = extractRequestId(payload);
  if (!requestId) {
    const rec = await db.labResultReconciliation.create({
      data: {
        organizationId,
        inboundPayload: payload as object,
        status: "PENDENTE",
        ambiguityReason: "Identificador do pedido ausente no DiagnosticReport",
      },
    });
    return { status: "PENDENTE", reconciliationId: rec.id, reason: rec.ambiguityReason! };
  }

  const matches = await db.examRequest.findMany({
    where: { id: requestId },
    include: { encounter: true, items: true },
  });

  if (matches.length === 0) {
    const rec = await db.labResultReconciliation.create({
      data: {
        organizationId,
        externalRequestId: requestId,
        inboundPayload: payload as object,
        status: "PENDENTE",
        ambiguityReason: `Pedido ${requestId} não encontrado`,
      },
    });
    return { status: "PENDENTE", reconciliationId: rec.id, reason: rec.ambiguityReason! };
  }

  if (matches.length > 1) {
    const rec = await db.labResultReconciliation.create({
      data: {
        organizationId,
        externalRequestId: requestId,
        inboundPayload: payload as object,
        status: "PENDENTE",
        ambiguityReason: `Múltiplos pedidos encontrados para ${requestId}`,
      },
    });
    return { status: "PENDENTE", reconciliationId: rec.id, reason: rec.ambiguityReason! };
  }

  const request = matches[0];
  const patientId = request.patientId;
  const resultedAt = new Date(
    payload.diagnosticReport.effectiveDateTime ?? payload.diagnosticReport.issued ?? Date.now(),
  );

  const values = payload.observations.map((obs) => {
    const v = observationFromFhir(obs, patientId, "pending");
    return {
      organizationId,
      name: v.name,
      value: v.value,
      unit: v.unit,
      referenceRange: v.referenceRange,
    };
  });

  const result = await db.examResult.create({
    data: {
      organizationId,
      patientId,
      encounterId: request.encounterId,
      requestId: request.id,
      fileName: payload.diagnosticReport.code?.text ?? "Resultado laboratorial",
      mimeType: "application/fhir+json",
      resultedAt,
      values: { create: values },
    },
    include: { values: true },
  });

  await db.labResultReconciliation.create({
    data: {
      organizationId,
      externalRequestId: requestId,
      inboundPayload: payload as object,
      status: "CONCILIADO",
      matchedRequestId: request.id,
      matchedResultId: result.id,
      processedAt: new Date(),
    },
  });

  const outOfRange = result.values.filter((v) => isOutOfReference(v.value, v.referenceRange));
  const encounter = request.encounter;

  const authorMembership = await adminPrisma.membership.findFirst({
    where: { userId: encounter.authorUserId, organizationId },
    select: { userId: true },
  });

  if (authorMembership) {
    const alert = outOfRange.length
      ? ` Valores fora da referência: ${outOfRange.map((v) => v.name).join(", ")}.`
      : "";
    await createNotification({
      organizationId,
      userId: authorMembership.userId,
      type: "LAB_RESULT_RECEIVED",
      title: "Resultado de exame recebido",
      body: `Resultado conciliado para pedido ${request.id}.${alert}`,
      metadata: { requestId: request.id, resultId: result.id, outOfRange: outOfRange.length > 0 },
    });
  }

  const settings = await db.interoperabilitySettings.findUnique({
    where: { organizationId },
  });
  const bookingConfig = await adminPrisma.onlineBookingConfig.findUnique({
    where: { organizationId },
  });

  if (!settings || bookingConfig?.autoReleaseDocuments !== false) {
    await releaseDocument({
      organizationId,
      patientId,
      documentType: "EXAM_RESULT",
      examResultId: result.id,
      autoReleased: true,
    });
  }

  return { status: "CONCILIADO", resultId: result.id, requestId: request.id };
}

export async function manualReconcile(
  db: TenantClient,
  organizationId: string,
  reconciliationId: string,
  requestId: string,
) {
  const rec = await db.labResultReconciliation.findFirstOrThrow({
    where: { id: reconciliationId, organizationId, status: "PENDENTE" },
  });

  const payload = rec.inboundPayload as unknown as LabResultPayload;
  payload.externalRequestId = requestId;
  if (payload.diagnosticReport) {
    payload.diagnosticReport.basedOn = [{ reference: `ServiceRequest/${requestId}` }];
  }

  await db.labResultReconciliation.update({
    where: { id: reconciliationId },
    data: { status: "REJEITADO", processedAt: new Date() },
  });

  return reconcileLabResult(db, organizationId, payload);
}

export async function sendExamRequestToLab(
  db: TenantClient,
  organizationId: string,
  requestId: string,
) {
  const request = await db.examRequest.findFirstOrThrow({
    where: { id: requestId },
    include: { items: true, patient: true },
  });

  const adapter = getLabIntegrationAdapter();
  return adapter.sendOrder({
    requestId: request.id,
    patientId: request.patientId,
    patientName: request.patient.fullName,
    exams: request.items.map((i) => ({ name: i.examName, instructions: i.instructions })),
  });
}

export async function simulateLabResult(requestId: string) {
  const adapter = getLabIntegrationAdapter();
  if (!adapter.simulateResult) {
    throw new Error("Simulador não disponível");
  }
  return adapter.simulateResult(requestId);
}

export async function listPendingReconciliations(db: TenantClient, organizationId: string) {
  return db.labResultReconciliation.findMany({
    where: { organizationId, status: "PENDENTE" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
