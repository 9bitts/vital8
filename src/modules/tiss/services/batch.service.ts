import type { TenantClient } from "@/lib/db/tenant-client";
import { getStorageAdapter } from "@/lib/integrations/storage";
import { getTissTransportAdapter } from "@/lib/integrations/tiss-transport";
import { nextSequenceNumber } from "@/lib/tiss/sequence";
import type { TissGuidePayload } from "@/lib/tiss/types";
import { validateTissXmlStructure } from "@/lib/tiss/validator";
import { buildTissBatchXml } from "@/lib/tiss/xml-builder";
import { batchCreateSchema, batchReopenSchema } from "../schemas/tiss.schema";
import { revalidateGuide } from "./guide.service";

export async function createBatch(
  db: TenantClient,
  organizationId: string,
  input: unknown,
) {
  const data = batchCreateSchema.parse(input);

  for (const guideId of data.guideIds) {
    await revalidateGuide(db, guideId);
  }

  const guides = await db.tissGuide.findMany({
    where: {
      id: { in: data.guideIds },
      healthInsurerId: data.healthInsurerId,
      status: "PRONTA",
      tissBatchId: null,
    },
    include: { healthInsurer: true },
  });

  if (guides.length !== data.guideIds.length) {
    throw new Error("Algumas guias não estão prontas ou pertencem a outra operadora");
  }

  const batchNumber = await nextSequenceNumber(
    db,
    organizationId,
    data.healthInsurerId,
    "BATCH",
  );

  const batch = await db.tissBatch.create({
    data: {
      organizationId,
      healthInsurerId: data.healthInsurerId,
      batchNumber,
      competence: data.competence,
      status: "ABERTO",
    },
  });

  await db.tissGuide.updateMany({
    where: { id: { in: data.guideIds } },
    data: { tissBatchId: batch.id, status: "EM_LOTE" },
  });

  return batch;
}

export async function closeBatch(
  db: TenantClient,
  organizationId: string,
  batchId: string,
) {
  const batch = await db.tissBatch.findFirstOrThrow({
    where: { id: batchId },
    include: {
      healthInsurer: true,
      guides: true,
      organization: true,
    },
  });

  if (batch.status !== "ABERTO" && batch.status !== "REABERTO") {
    throw new Error("Lote não pode ser fechado neste status");
  }

  for (const guide of batch.guides) {
    const errors = guide.validationErrors as unknown[];
    if (errors.length > 0) {
      throw new Error(`Guia ${guide.guideNumber} possui pendências de validação`);
    }
  }

  const settings = batch.organization.settings as Record<string, unknown>;
  const cnes = (settings.cnes as string) ?? batch.guides[0]?.providerCnes ?? null;

  const { xml, hash } = buildTissBatchXml({
    tissVersion: batch.healthInsurer.tissVersion,
    ansRegistration: batch.healthInsurer.ansRegistration,
    providerDocument: batch.organization.documentNumber,
    providerCodeAtInsurer: batch.healthInsurer.providerCodeAtInsurer,
    providerCnes: cnes,
    batchNumber: batch.batchNumber,
    competence: batch.competence,
    guides: batch.guides.map((g) => ({
      guideType: g.guideType,
      payload: g.payload as TissGuidePayload,
    })),
  });

  const xmlErrors = validateTissXmlStructure(xml);
  if (xmlErrors.length > 0) {
    throw new Error(
      `XML inválido: ${xmlErrors.map((e) => e.message).join("; ")}`,
    );
  }

  const storage = getStorageAdapter();
  const stored = await storage.upload(
    organizationId,
    batch.id,
    `lote-${batch.batchNumber}.xml`,
    "application/xml",
    Buffer.from(xml, "utf8"),
  );

  const totalCents = batch.guides.reduce((s, g) => s + g.totalValueCents, 0);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + batch.healthInsurer.paymentTermDays);

  const firstAppt = await db.appointment.findFirstOrThrow({
    where: { id: batch.guides[0]!.appointmentId },
  });

  await db.receivable.create({
    data: {
      organizationId,
      patientId: firstAppt.patientId,
      healthInsurerId: batch.healthInsurerId,
      origin: "TISS_BATCH",
      description: `Lote TISS #${batch.batchNumber} — ${batch.healthInsurer.name}`,
      totalCents,
      dueDate,
      tissBatchId: batchId,
    },
  });

  return db.tissBatch.update({
    where: { id: batchId },
    data: {
      status: "FECHADO",
      xmlHash: hash,
      xmlStorageKey: stored.storageKey,
    },
  });
}

export async function sendBatch(db: TenantClient, batchId: string) {
  const batch = await db.tissBatch.findFirstOrThrow({
    where: { id: batchId },
    include: { healthInsurer: true },
  });

  if (batch.status !== "FECHADO") {
    throw new Error("Apenas lotes fechados podem ser enviados");
  }
  if (!batch.xmlStorageKey) {
    throw new Error("XML do lote não encontrado");
  }

  const storage = getStorageAdapter();
  const file = await storage.download(batch.xmlStorageKey);
  const transport = getTissTransportAdapter();
  const result = await transport.sendBatch(file.toString("utf8"), {
    batchId: batch.id,
    ansRegistration: batch.healthInsurer.ansRegistration,
  });

  await db.tissGuide.updateMany({
    where: { tissBatchId: batchId },
    data: { status: "ENVIADA" },
  });

  return db.tissBatch.update({
    where: { id: batchId },
    data: {
      status: "ENVIADO",
      sendProtocol: result.protocol,
      sentAt: result.sentAt,
    },
  });
}

export async function reopenBatch(
  db: TenantClient,
  userId: string,
  input: unknown,
) {
  const data = batchReopenSchema.parse(input);
  const batch = await db.tissBatch.findFirstOrThrow({
    where: { id: data.batchId },
  });

  if (batch.status === "ENVIADO" || batch.status === "CONCILIADO") {
    throw new Error("Lote já enviado ou conciliado não pode ser reaberto");
  }

  await db.tissGuide.updateMany({
    where: { tissBatchId: batch.id },
    data: { status: "PRONTA", tissBatchId: null },
  });

  return db.tissBatch.update({
    where: { id: batch.id },
    data: {
      status: "REABERTO",
      reopenedAt: new Date(),
      reopenedByUserId: userId,
      reopenReason: data.reason,
      xmlHash: null,
      xmlStorageKey: null,
    },
  });
}

export async function listBatches(db: TenantClient, healthInsurerId?: string) {
  return db.tissBatch.findMany({
    where: healthInsurerId ? { healthInsurerId } : {},
    include: {
      healthInsurer: true,
      guides: true,
      receivable: true,
      insurerPayments: true,
    },
    orderBy: [{ competence: "desc" }, { batchNumber: "desc" }],
  });
}

export async function getBatchXml(db: TenantClient, batchId: string) {
  const batch = await db.tissBatch.findFirstOrThrow({ where: { id: batchId } });
  if (!batch.xmlStorageKey) throw new Error("XML não disponível");
  const storage = getStorageAdapter();
  const file = await storage.download(batch.xmlStorageKey);
  return { xml: file.toString("utf8"), hash: batch.xmlHash };
}
