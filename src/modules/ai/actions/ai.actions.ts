"use server";

import { revalidatePath } from "next/cache";
import { adminPrisma } from "@/lib/db/admin-client";
import { requireAuth } from "@/lib/auth/guards";
import { hasOrgFeature } from "@/lib/features/subscription.service";
import type { AiInteractionOutcome, AiResourceType } from "@/generated/prisma/client";
import { AI_TERM_VERSION, AI_RESOURCE_LABELS } from "@/modules/ai/lib/consent";
import { getUsageSummary } from "@/modules/ai/lib/usage";
import { processSecretaryMessage, listConversationMessages } from "@/modules/ai/services/secretary.service";
import {
  summarizePatientHistory,
  structureSoapFromText,
  suggestCid10Codes,
  aiTranscribe,
  updateAiInteractionOutcome,
} from "@/modules/ai/services/clinical-copilot.service";
import { AI_CLINICAL_FOOTER } from "@/modules/ai/lib/constants";
import { rankTodayAppointmentsByNoShowRisk } from "@/modules/ai/services/no-show-score.service";
import { prioritizeOverdueReceivables, draftCollectionMessage } from "@/modules/ai/services/smart-collection.service";
import { generateMonthlyInsights, explainChart } from "@/modules/ai/services/bi-insights.service";
import { draftGlosaAppeal } from "@/modules/ai/services/glosa-draft.service";
import { interpretSmartSearch, NAV_ITEMS } from "@/modules/ai/services/smart-search.service";
import { createAuditLog } from "@/modules/core/services/audit.service";

type Result<T = void> = { success: true; data?: T } | { success: false; error: string };

async function requireAiAdmin() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  const ok = await hasOrgFeature(ctx.organizationId, "ai");
  if (!ok) throw new Error("IA disponível no plano ENTERPRISE");
  return ctx;
}

export async function getAiSettingsAction() {
  const ctx = await requireAiAdmin();
  const [settings, consents, usage, faqs] = await Promise.all([
    adminPrisma.aiSettings.findUnique({ where: { organizationId: ctx.organizationId } }),
    adminPrisma.aiDataProcessingConsent.findMany({ where: { organizationId: ctx.organizationId } }),
    getUsageSummary(ctx.organizationId),
    adminPrisma.aiFaq.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  return { settings, consents, usage, faqs, labels: AI_RESOURCE_LABELS, termVersion: AI_TERM_VERSION };
}

export async function saveAiSettingsAction(input: {
  enabledResources: Record<string, boolean>;
  model?: string;
  temperature?: number;
  language?: string;
  silenceStartHour?: number | null;
  silenceEndHour?: number | null;
  monthlyTokenLimit?: number;
}): Promise<Result> {
  try {
    const ctx = await requireAuth(["OWNER"]);
    await adminPrisma.aiSettings.upsert({
      where: { organizationId: ctx.organizationId },
      create: {
        organizationId: ctx.organizationId,
        enabledResources: input.enabledResources,
        model: input.model ?? "claude-3-5-sonnet-latest",
        temperature: input.temperature ?? 0.3,
        language: input.language ?? "pt-BR",
        silenceStartHour: input.silenceStartHour ?? null,
        silenceEndHour: input.silenceEndHour ?? null,
        monthlyTokenLimit: input.monthlyTokenLimit ?? 500_000,
      },
      update: {
        enabledResources: input.enabledResources,
        model: input.model,
        temperature: input.temperature,
        language: input.language,
        silenceStartHour: input.silenceStartHour,
        silenceEndHour: input.silenceEndHour,
        monthlyTokenLimit: input.monthlyTokenLimit,
      },
    });
    revalidatePath("/app/configuracoes/ia");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function grantAiConsentAction(resource: AiResourceType): Promise<Result> {
  try {
    const ctx = await requireAuth(["OWNER"]);
    await adminPrisma.aiDataProcessingConsent.upsert({
      where: { organizationId_resource: { organizationId: ctx.organizationId, resource } },
      create: {
        organizationId: ctx.organizationId,
        resource,
        termVersion: AI_TERM_VERSION,
        grantedByUserId: ctx.userId,
      },
      update: {
        termVersion: AI_TERM_VERSION,
        grantedByUserId: ctx.userId,
        grantedAt: new Date(),
        revokedAt: null,
      },
    });
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "ai.consent.grant",
      entityType: "AiDataProcessingConsent",
      entityId: resource,
      metadata: { termVersion: AI_TERM_VERSION },
    });
    revalidatePath("/app/configuracoes/ia");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function simulateSecretaryAction(input: {
  phone: string;
  message: string;
  conversationId?: string;
}): Promise<Result<{ reply: string; conversationId: string; intent: string; handoff: boolean }>> {
  try {
    const ctx = await requireAiAdmin();
    const result = await processSecretaryMessage({
      organizationId: ctx.organizationId,
      phone: input.phone,
      message: input.message,
      conversationId: input.conversationId,
      simulate: true,
    });
    return {
      success: true,
      data: {
        reply: result.reply,
        conversationId: result.conversationId!,
        intent: String(result.intent),
        handoff: result.handoff,
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listAiConversationsAction() {
  const ctx = await requireAiAdmin();
  return adminPrisma.aiConversation.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

export async function getConversationMessagesAction(conversationId: string) {
  const ctx = await requireAiAdmin();
  return listConversationMessages(conversationId, ctx.organizationId);
}

export async function saveFaqAction(input: {
  id?: string;
  question: string;
  answer: string;
}): Promise<Result<{ id: string }>> {
  try {
    const ctx = await requireAiAdmin();
    if (input.id) {
      await adminPrisma.aiFaq.updateMany({
        where: { id: input.id, organizationId: ctx.organizationId },
        data: { question: input.question, answer: input.answer },
      });
      return { success: true, data: { id: input.id } };
    }
    const row = await adminPrisma.aiFaq.create({
      data: {
        organizationId: ctx.organizationId,
        question: input.question,
        answer: input.answer,
      },
    });
    revalidatePath("/app/configuracoes/ia");
    return { success: true, data: { id: row.id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function summarizeHistoryAction(patientId: string) {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"]);
    const result = await summarizePatientHistory(
      ctx.organizationId,
      ctx.userId,
      ctx.db,
      patientId,
    );
    return { success: true as const, data: { ...result, footer: AI_CLINICAL_FOOTER } };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function structureSoapAction(freeText: string) {
  try {
    const ctx = await requireAuth(["PROFISSIONAL_SAUDE", "ADMIN", "OWNER"]);
    const result = await structureSoapFromText(ctx.organizationId, ctx.userId, freeText);
    return { success: true as const, data: { ...result, footer: AI_CLINICAL_FOOTER } };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function suggestCidAction(hypothesis: string) {
  try {
    const ctx = await requireAuth(["PROFISSIONAL_SAUDE", "ADMIN", "OWNER"]);
    const result = await suggestCid10Codes(ctx.organizationId, ctx.userId, hypothesis, ctx.db);
    return { success: true as const, data: { ...result, footer: AI_CLINICAL_FOOTER } };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function transcribeAudioAction(audioBase64: string) {
  try {
    const ctx = await requireAuth(["PROFISSIONAL_SAUDE", "ADMIN", "OWNER"]);
    const result = await aiTranscribe(ctx.organizationId, ctx.userId, audioBase64);
    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function recordAiOutcomeAction(logId: string, outcome: AiInteractionOutcome): Promise<Result> {
  try {
    const ctx = await requireAuth();
    await updateAiInteractionOutcome(logId, ctx.organizationId, outcome);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function getNoShowRankingAction() {
  const ctx = await requireAuth(["RECEPCAO", "ADMIN", "OWNER"]);
  return rankTodayAppointmentsByNoShowRisk(ctx.db);
}

export async function getCollectionPriorityAction() {
  const ctx = await requireAuth(["FINANCEIRO", "ADMIN", "OWNER"]);
  return prioritizeOverdueReceivables(ctx.db);
}

export async function draftCollectionTextAction(
  templateBody: string,
  context: { patientInitials: string; amountCents: number; daysOverdue: number },
) {
  try {
    const ctx = await requireAuth(["FINANCEIRO", "ADMIN", "OWNER"]);
    const result = await draftCollectionMessage(
      ctx.organizationId,
      ctx.userId,
      templateBody,
      context,
    );
    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function getMonthlyInsightsAction(aggregates: Parameters<typeof generateMonthlyInsights>[2]) {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    const result = await generateMonthlyInsights(ctx.organizationId, ctx.userId, aggregates);
    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function explainChartAction(chartTitle: string, series: unknown) {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    const result = await explainChart(ctx.organizationId, ctx.userId, chartTitle, series);
    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function draftGlosaAppealAction(context: Parameters<typeof draftGlosaAppeal>[2]) {
  try {
    const ctx = await requireAuth(["FINANCEIRO", "ADMIN", "OWNER"]);
    const result = await draftGlosaAppeal(ctx.organizationId, ctx.userId, context);
    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function smartSearchAction(query: string) {
  try {
    const ctx = await requireAuth();
    const result = await interpretSmartSearch(ctx.organizationId, ctx.userId, query);
    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Erro", data: { route: null, literalQuery: query } };
  }
}

export async function getNavItemsAction() {
  return NAV_ITEMS;
}
