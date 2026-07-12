"use server";

import { revalidatePath } from "next/cache";
import { adminPrisma } from "@/lib/db/admin-client";
import {
  type ActionResult,
  AuthError,
  requireAuth,
} from "@/lib/auth/guards";
import { canManageTissBilling, canViewTissEligibility, isTissEnabledForPlan } from "../lib/permissions";
import {
  createBatch,
  closeBatch,
  sendBatch,
  reopenBatch,
  listBatches,
  getBatchXml,
  getBatchAccountingCsv,
} from "../services/batch.service";
import {
  listPriorAuthorizations,
  listExpiringAuthorizations,
  upsertPriorAuthorization,
} from "../services/authorization.service";
import { checkAppointmentEligibility } from "../services/eligibility.service";
import {
  generateGuideFromAppointment,
  listGuides,
  updateGuideFields,
  revalidateGuide,
  getGuideForPrint,
} from "../services/guide.service";
import {
  listHealthInsurers,
  upsertHealthInsurer,
  createInsurerContract,
} from "../services/insurer.service";
import {
  getTissIndicators,
} from "../services/indicators.service";
import {
  registerInsurerPayment,
  listGlosaItems,
  startGlosaAppeal,
  resolveGlosaAppeal,
  getConciliationView,
} from "../services/conciliation.service";
import {
  searchTussProcedures,
  importTussFromCsv,
  mapServiceToTuss,
  listServiceTussMappings,
} from "../services/tuss.service";
import { guideUpdateSchema } from "../schemas/tiss.schema";

async function requireTiss(ctx: Awaited<ReturnType<typeof requireAuth>>) {
  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: ctx.organizationId },
  });
  if (!isTissEnabledForPlan(org.plan)) {
    throw new AuthError("Módulo TISS não disponível no plano atual", "FORBIDDEN");
  }
  return org;
}

export async function listInsurersAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  await requireTiss(ctx);
  return listHealthInsurers(ctx.db);
}

export async function saveInsurerAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
    await requireTiss(ctx);
    await upsertHealthInsurer(ctx.db, ctx.organizationId, input);
    revalidatePath("/app/configuracoes/convenios");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function saveInsurerContractAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
    await requireTiss(ctx);
    await createInsurerContract(ctx.db, ctx.organizationId, input);
    revalidatePath("/app/configuracoes/convenios");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function searchTussAction(query: string) {
  await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  return searchTussProcedures(query);
}

export async function importTussCsvAction(csv: string): Promise<ActionResult<{ imported: number }>> {
  try {
    await requireAuth(["OWNER", "ADMIN"]);
    const imported = await importTussFromCsv(csv);
    return { success: true, data: { imported } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function mapServiceTussAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
    await requireTiss(ctx);
    await mapServiceToTuss(ctx.db, input);
    revalidatePath("/app/configuracoes/convenios");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listServiceMappingsAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  await requireTiss(ctx);
  return listServiceTussMappings(ctx.db);
}

export async function listAuthorizationsAction(filters?: {
  status?: string;
  patientId?: string;
}) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO", "RECEPCAO"]);
  await requireTiss(ctx);
  return listPriorAuthorizations(ctx.db, filters);
}

export async function saveAuthorizationAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO", "RECEPCAO"]);
    await requireTiss(ctx);
    await upsertPriorAuthorization(ctx.db, ctx.organizationId, input);
    revalidatePath("/app/faturamento/autorizacoes");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listExpiringAuthAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO", "RECEPCAO"]);
  await requireTiss(ctx);
  return listExpiringAuthorizations(ctx.db);
}

export async function checkEligibilityAction(appointmentId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO", "RECEPCAO"]);
  if (!canViewTissEligibility(ctx.role)) {
    throw new AuthError("Permissão insuficiente", "FORBIDDEN");
  }
  await requireTiss(ctx);
  return checkAppointmentEligibility(ctx.db, appointmentId);
}

export async function listGuidesAction(filters?: {
  competence?: string;
  healthInsurerId?: string;
  status?: string;
}) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  await requireTiss(ctx);
  if (!canManageTissBilling(ctx.role)) {
    throw new AuthError("Permissão insuficiente", "FORBIDDEN");
  }
  return listGuides(ctx.db, filters);
}

export async function updateGuideAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
    await requireTiss(ctx);
    const parsed = guideUpdateSchema.parse(input);
    await updateGuideFields(ctx.db, parsed.guideId, parsed);
    revalidatePath("/app/faturamento");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function createBatchAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
    await requireTiss(ctx);
    const batch = await createBatch(ctx.db, ctx.organizationId, input);
    revalidatePath("/app/faturamento");
    return { success: true, data: { id: batch.id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function closeBatchAction(batchId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
    await requireTiss(ctx);
    await closeBatch(ctx.db, ctx.organizationId, batchId);
    revalidatePath("/app/faturamento");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function sendBatchAction(batchId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
    await requireTiss(ctx);
    await sendBatch(ctx.db, batchId);
    revalidatePath("/app/faturamento");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function reopenBatchAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
    await requireTiss(ctx);
    await reopenBatch(ctx.db, ctx.userId, input);
    revalidatePath("/app/faturamento");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listBatchesAction(healthInsurerId?: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  await requireTiss(ctx);
  return listBatches(ctx.db, healthInsurerId);
}

export async function downloadBatchXmlAction(batchId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  await requireTiss(ctx);
  return getBatchXml(ctx.db, batchId);
}

export async function downloadBatchAccountingCsvAction(batchId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  await requireTiss(ctx);
  return getBatchAccountingCsv(ctx.db, batchId);
}

export async function registerPaymentAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
    await requireTiss(ctx);
    await registerInsurerPayment(ctx.db, ctx.organizationId, ctx.userId, input);
    revalidatePath("/app/faturamento/conciliacao");
    revalidatePath("/app/faturamento/glosas");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listGlosasAction(status?: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  await requireTiss(ctx);
  return listGlosaItems(ctx.db, status);
}

export async function appealGlosaAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
    await requireTiss(ctx);
    await startGlosaAppeal(ctx.db, input);
    revalidatePath("/app/faturamento/glosas");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function resolveGlosaAction(
  glosaItemId: string,
  outcome: "RECUPERADA" | "PERDIDA",
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
    await requireTiss(ctx);
    await resolveGlosaAppeal(ctx.db, glosaItemId, outcome);
    revalidatePath("/app/faturamento/glosas");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function getConciliationAction(batchId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  await requireTiss(ctx);
  return getConciliationView(ctx.db, batchId);
}

export async function getIndicatorsAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  await requireTiss(ctx);
  return getTissIndicators(ctx.db);
}

export async function getGuidePrintAction(guideId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO", "RECEPCAO"]);
  await requireTiss(ctx);
  return getGuideForPrint(ctx.db, guideId);
}

/** Hook pós-finalização — chamado de appointment.actions */
export async function onAppointmentFinalized(
  db: Parameters<typeof generateGuideFromAppointment>[0],
  organizationId: string,
  appointmentId: string,
) {
  const org = await adminPrisma.organization.findFirst({ where: { id: organizationId } });
  if (!org || !isTissEnabledForPlan(org.plan)) return null;

  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId },
  });
  if (!appointment || appointment.isPrivate) return null;

  return generateGuideFromAppointment(db, organizationId, appointmentId);
}

export async function revalidateGuideAction(guideId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
    await requireTiss(ctx);
    await revalidateGuide(ctx.db, guideId);
    revalidatePath("/app/faturamento");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}
