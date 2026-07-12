"use server";

import { revalidatePath } from "next/cache";
import {
  requireAuth,
  type ActionResult,
} from "@/lib/auth/guards";
import { createAuditLog } from "@/modules/core/services/audit.service";
import {
  carnêLeaoReportSchema,
  fiscalSettingsSchema,
  manualEmitSchema,
} from "@/modules/finance/schemas/fiscal.schema";
import {
  emitFiscalDocument,
  enqueueFiscalEmission,
  generateCarnêLeaoReport,
  listFiscalDocuments,
} from "@/modules/finance/services/fiscal-document.service";
import {
  getOrCreateFiscalSettings,
  maskFiscalSettings,
  saveFiscalSettings,
} from "@/modules/finance/services/fiscal-settings.service";
import { processFiscalQueue } from "@/modules/finance/services/fiscal-queue.service";

const FISCAL_ROLES = ["OWNER", "ADMIN", "FINANCEIRO"] as const;

export async function getFiscalSettingsAction() {
  const ctx = await requireAuth([...FISCAL_ROLES, "RECEPCAO"]);
  const settings = await getOrCreateFiscalSettings(ctx.db, ctx.organizationId);
  return maskFiscalSettings(settings);
}

export async function saveFiscalSettingsAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    fiscalSettingsSchema.parse(input);
    await saveFiscalSettings(ctx.db, ctx.organizationId, input);
    await createAuditLog({
      action: "fiscal.settings.update",
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      entityType: "FiscalSettings",
      entityId: ctx.organizationId,
    });
    revalidatePath("/app/configuracoes/fiscal");
    return { success: true };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao salvar configurações fiscais" };
  }
}

export async function listFiscalDocumentsAction() {
  const ctx = await requireAuth([...FISCAL_ROLES, "RECEPCAO"]);
  return listFiscalDocuments(ctx.db, ctx.organizationId);
}

export async function manualEmitFiscalDocumentAction(
  input: unknown,
): Promise<ActionResult<{ documentId: string }>> {
  try {
    const ctx = await requireAuth([...FISCAL_ROLES]);
    const parsed = manualEmitSchema.parse(input);
    const doc = await enqueueFiscalEmission(
      ctx.db,
      ctx.organizationId,
      parsed.paymentId,
      { force: true },
    );
    if (!doc) {
      return { success: false, error: "Não foi possível enfileirar emissão" };
    }
    const issued = await emitFiscalDocument(ctx.db, ctx.organizationId, doc.id);
    revalidatePath("/app/financeiro/fiscal");
    return { success: true, data: { documentId: issued.id } };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro na emissão manual" };
  }
}

export async function retryFiscalDocumentAction(
  documentId: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth([...FISCAL_ROLES]);
    await emitFiscalDocument(ctx.db, ctx.organizationId, documentId);
    revalidatePath("/app/financeiro/fiscal");
    return { success: true };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao reprocessar documento" };
  }
}

export async function exportCarnêLeaoAction(
  input: unknown,
): Promise<ActionResult<{ csv: string; totalCents: number; count: number }>> {
  try {
    const ctx = await requireAuth([...FISCAL_ROLES]);
    const parsed = carnêLeaoReportSchema.parse(input);
    const report = await generateCarnêLeaoReport(
      ctx.db,
      ctx.organizationId,
      parsed.year,
      parsed.month,
      parsed.professionalId,
    );
    return {
      success: true,
      data: {
        csv: report.csv,
        totalCents: report.totalCents,
        count: report.rows.length,
      },
    };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao gerar relatório" };
  }
}

export async function processFiscalQueueAction(): Promise<
  ActionResult<{ processed: number; issued: number; failed: number }>
> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    const result = await processFiscalQueue(ctx.db, ctx.organizationId);
    revalidatePath("/app/financeiro/fiscal");
    return { success: true, data: result };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao processar fila fiscal" };
  }
}
