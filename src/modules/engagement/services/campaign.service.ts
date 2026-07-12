import type { ReleasedDocumentType } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { renderMessageTemplate } from "../lib/template-renderer";
import { enqueueCommunication } from "./automation.service";

export async function releaseDocument(input: {
  organizationId: string;
  patientId: string;
  documentType: ReleasedDocumentType;
  prescriptionId?: string;
  certificateId?: string;
  examResultId?: string;
  releasedByUserId?: string;
  autoReleased?: boolean;
}) {
  return adminPrisma.releasedDocument.create({
    data: {
      organizationId: input.organizationId,
      patientId: input.patientId,
      documentType: input.documentType,
      prescriptionId: input.prescriptionId ?? null,
      certificateId: input.certificateId ?? null,
      examResultId: input.examResultId ?? null,
      releasedByUserId: input.releasedByUserId ?? null,
      autoReleased: input.autoReleased ?? false,
    },
  });
}

export async function revokeReleasedDocument(
  organizationId: string,
  documentId: string,
) {
  return adminPrisma.releasedDocument.updateMany({
    where: { id: documentId, organizationId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function autoReleaseEncounterDocuments(
  organizationId: string,
  encounterId: string,
) {
  const config = await adminPrisma.onlineBookingConfig.findUnique({
    where: { organizationId },
  });
  if (config && !config.autoReleaseDocuments) return [];

  const encounter = await adminPrisma.encounter.findFirstOrThrow({
    where: { id: encounterId, organizationId },
    include: {
      prescriptions: true,
      certificates: true,
      examResults: true,
    },
  });

  const released = [];
  for (const rx of encounter.prescriptions) {
    released.push(
      await releaseDocument({
        organizationId,
        patientId: encounter.patientId,
        documentType: "PRESCRIPTION",
        prescriptionId: rx.id,
        autoReleased: true,
      }),
    );
  }
  for (const cert of encounter.certificates) {
    released.push(
      await releaseDocument({
        organizationId,
        patientId: encounter.patientId,
        documentType: "MEDICAL_CERTIFICATE",
        certificateId: cert.id,
        autoReleased: true,
      }),
    );
  }
  for (const ex of encounter.examResults) {
    released.push(
      await releaseDocument({
        organizationId,
        patientId: encounter.patientId,
        documentType: "EXAM_RESULT",
        examResultId: ex.id,
        autoReleased: true,
      }),
    );
  }
  return released;
}

export type CampaignFilter = {
  tags?: string[];
  insurerName?: string;
  lastVisitBefore?: string;
  birthdayMonth?: number;
};

export async function queueCampaign(
  organizationId: string,
  campaignId: string,
  userId: string,
) {
  const campaign = await adminPrisma.campaign.findFirstOrThrow({
    where: { id: campaignId, organizationId },
    include: { template: true },
  });

  const filter = campaign.filter as CampaignFilter;
  const patients = await adminPrisma.patient.findMany({
    where: {
      organizationId,
      isActive: true,
      ...(filter.tags?.length ? { tags: { hasSome: filter.tags } } : {}),
      ...(filter.birthdayMonth
        ? {
            birthDate: { not: null },
          }
        : {}),
    },
  });

  let targets = patients;
  if (filter.birthdayMonth) {
    targets = patients.filter(
      (p) => p.birthDate && p.birthDate.getUTCMonth() + 1 === filter.birthdayMonth,
    );
  }
  if (filter.lastVisitBefore) {
    const before = new Date(filter.lastVisitBefore);
    const filtered = [];
    for (const p of targets) {
      const last = await adminPrisma.encounter.findFirst({
        where: { patientId: p.id, organizationId },
        orderBy: { startedAt: "desc" },
      });
      if (!last || last.startedAt < before) filtered.push(p);
    }
    targets = filtered;
  }

  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: organizationId },
  });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  for (const patient of targets) {
    const body = renderMessageTemplate(campaign.template.body, {
      paciente: patient.fullName,
      clinica: org.name,
      descadastro: `${baseUrl}/portal/opt-out?patient=${patient.id}&org=${organizationId}`,
    });
    await enqueueCommunication({
      organizationId,
      patientId: patient.id,
      channel: campaign.template.channel,
      templateId: campaign.templateId,
      subject: campaign.template.subject,
      body,
      origin: "CAMPANHA",
      originRefId: campaignId,
      idempotencyKey: `campaign:${campaignId}:${patient.id}`,
      campaignId,
    });
  }

  await adminPrisma.campaign.update({
    where: { id: campaignId },
    data: { status: "NA_FILA", sentAt: new Date() },
  });

  void userId;
  return targets.length;
}

export async function listReleasedForPatient(
  db: TenantClient,
  patientId: string,
) {
  return db.releasedDocument.findMany({
    where: { patientId, revokedAt: null },
    orderBy: { releasedAt: "desc" },
  });
}
