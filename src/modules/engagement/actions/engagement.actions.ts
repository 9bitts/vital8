"use server";

import { revalidatePath } from "next/cache";
import { adminPrisma } from "@/lib/db/admin-client";
import {
  AuthError,
  requireAuth,
  type ActionResult,
} from "@/lib/auth/guards";
import { hasFeature } from "@/lib/features/features.service";
import {
  canApproveOnlineBooking,
  canManageCampaigns,
  canManageEngagementConfig,
  canOperateCommunications,
  canReleaseClinicalDocument,
  canViewNpsReport,
} from "../lib/permissions";
import { processCommunicationQueue, retryCommunication } from "../services/queue-processor.service";
import { runAutomationScanners } from "../services/automation.service";
import {
  approveOnlineAppointment,
  listPendingOnlineApprovals,
  rejectOnlineAppointment,
} from "../services/online-booking.service";
import { getNpsReport } from "../services/nps.service";
import { queueCampaign } from "../services/campaign.service";
import { releaseDocument, revokeReleasedDocument } from "../services/campaign.service";
import { renderMessageTemplate } from "../lib/template-renderer";

async function requireEngagement(ctx: Awaited<ReturnType<typeof requireAuth>>) {
  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: ctx.organizationId },
  });
  if (
    !hasFeature(org.plan, "patient_portal") &&
    !hasFeature(org.plan, "online_scheduling") &&
    !hasFeature(org.plan, "telemedicine")
  ) {
    throw new AuthError("Módulo não disponível no plano", "FORBIDDEN");
  }
}

export async function listCommunicationsAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
  await requireEngagement(ctx);
  return ctx.db.communicationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      patient: { select: { fullName: true } },
      template: { select: { name: true } },
    },
  });
}

export async function processQueueAction(): Promise<ActionResult<{ sent: number }>> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    await requireEngagement(ctx);
    const result = await processCommunicationQueue();
    revalidatePath("/app/relacionamento");
    return { success: true, data: { sent: result.sent } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function retryCommunicationAction(logId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
    await requireEngagement(ctx);
    if (!canOperateCommunications(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    await retryCommunication(logId, ctx.organizationId);
    revalidatePath("/app/relacionamento");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listTemplatesAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  await requireEngagement(ctx);
  return ctx.db.messageTemplate.findMany({ orderBy: { eventKey: "asc" } });
}

export async function previewTemplateAction(templateId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  const tpl = await ctx.db.messageTemplate.findFirstOrThrow({
    where: { id: templateId },
  });
  return renderMessageTemplate(tpl.body, {
    paciente: "Maria Silva",
    data: "15/07/2026",
    hora: "14:00",
    profissional: "Dr. João",
    clinica: "Clínica Vida Plena",
    link: "https://exemplo.local/link",
    servico: "Consulta",
  });
}

export async function listAutomationRulesAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  await requireEngagement(ctx);
  return ctx.db.automationRule.findMany({
    include: { template: true, service: true },
    orderBy: { name: "asc" },
  });
}

export async function listPendingOnlineAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
  await requireEngagement(ctx);
  if (!canApproveOnlineBooking(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
  return listPendingOnlineApprovals(ctx.organizationId);
}

export async function approveOnlineAction(appointmentId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
    if (!canApproveOnlineBooking(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    await approveOnlineAppointment(ctx.organizationId, appointmentId);
    revalidatePath("/app/recepcao");
    revalidatePath("/app/relacionamento/aprovacoes");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function rejectOnlineAction(appointmentId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
    if (!canApproveOnlineBooking(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    await rejectOnlineAppointment(ctx.organizationId, appointmentId);
    revalidatePath("/app/recepcao");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function getOnlineBookingConfigAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  await requireEngagement(ctx);
  return ctx.db.onlineBookingConfig.findUnique({
    where: { organizationId: ctx.organizationId },
  });
}

export async function saveOnlineBookingConfigAction(input: {
  isEnabled: boolean;
  enabledServiceIds: string[];
  enabledProfessionalIds: string[];
  minAdvanceHours: number;
  maxAdvanceDays: number;
  requiresApproval: boolean;
  welcomeText?: string;
  autoReleaseDocuments: boolean;
}): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    if (!canManageEngagementConfig(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    await ctx.db.onlineBookingConfig.upsert({
      where: { organizationId: ctx.organizationId },
      create: { organizationId: ctx.organizationId, ...input },
      update: input,
    });
    revalidatePath("/app/configuracoes/agendamento-online");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function getNpsReportAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
  await requireEngagement(ctx);
  if (!canViewNpsReport(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
  return getNpsReport(ctx.organizationId);
}

export async function launchCampaignAction(campaignId: string): Promise<ActionResult<{ count: number }>> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    if (!canManageCampaigns(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    const count = await queueCampaign(ctx.organizationId, campaignId, ctx.userId);
    revalidatePath("/app/relacionamento/campanhas");
    return { success: true, data: { count } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function releaseDocumentAction(input: {
  patientId: string;
  documentType: "PRESCRIPTION" | "MEDICAL_CERTIFICATE" | "EXAM_RESULT";
  prescriptionId?: string;
  certificateId?: string;
  examResultId?: string;
}): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"]);
    if (!canReleaseClinicalDocument(ctx.role)) throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    await releaseDocument({
      organizationId: ctx.organizationId,
      patientId: input.patientId,
      documentType: input.documentType,
      prescriptionId: input.prescriptionId,
      certificateId: input.certificateId,
      examResultId: input.examResultId,
      releasedByUserId: ctx.userId,
    });
    revalidatePath(`/app/pacientes/${input.patientId}`);
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function revokeDocumentAction(documentId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"]);
    await revokeReleasedDocument(ctx.organizationId, documentId);
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function runAutomationScannersAction(): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    await runAutomationScanners(ctx.organizationId);
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listCampaignsAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  return ctx.db.campaign.findMany({
    include: { template: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listCorrectionRequestsAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "RECEPCAO"]);
  return ctx.db.patientDataCorrectionRequest.findMany({
    where: { status: "PENDENTE" },
    include: { patient: { select: { fullName: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createTeleconsultRoomAction(encounterId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"]);
  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: ctx.organizationId },
  });
  if (!hasFeature(org.plan, "telemedicine")) {
    throw new AuthError("Telemedicina não disponível", "FORBIDDEN");
  }
  const { createTeleconsultRoom } = await import("../services/teleconsult.service");
  return createTeleconsultRoom(ctx.organizationId, encounterId);
}
