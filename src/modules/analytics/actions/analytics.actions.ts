"use server";

import type { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import {
  AuthError,
  requireAuth,
  type ActionResult,
} from "@/lib/auth/guards";
import { hasFeature } from "@/lib/features/features.service";
import { adminPrisma } from "@/lib/db/admin-client";
import {
  getExecutiveDashboard,
  getProfessionalDashboard,
  getReceptionTodayDashboard,
  dashboardForRole,
} from "../services/dashboard.service";
import { reprocessMetricsRange } from "../services/aggregation.service";
import { getGoalProgress, listGoals, upsertGoal } from "../services/goal.service";
import { getEpidemiologyReport } from "../services/epidemiology.service";
import { generateReportPdf } from "../services/report-pdf.service";
import { monthRange } from "../lib/periods";
import {
  countUnread,
  listNotifications,
  markAllRead,
  markRead,
  saveNotificationPreferences,
  getNotificationPreferences,
} from "../services/notification.service";

async function requireBi(ctx: Awaited<ReturnType<typeof requireAuth>>) {
  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: ctx.organizationId },
  });
  if (!hasFeature(org.plan, "bi") && org.plan !== "STARTER") {
    throw new AuthError("BI não disponível no plano", "FORBIDDEN");
  }
}

export async function getDashboardAction(year?: number, month?: number) {
  const ctx = await requireAuth();
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  const kind = dashboardForRole(ctx.role);

  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: ctx.organizationId },
  });
  const fullBi = hasFeature(org.plan, "bi");

  if (!fullBi) {
    return {
      kind: "simple" as const,
      reception: await getReceptionTodayDashboard(ctx.db, ctx.organizationId),
    };
  }

  if (kind === "reception") {
    return {
      kind,
      data: await getReceptionTodayDashboard(ctx.db, ctx.organizationId),
    };
  }

  if (kind === "professional") {
    const prof = await ctx.db.professional.findFirst({
      where: { userId: ctx.userId, organizationId: ctx.organizationId },
    });
    if (!prof) throw new AuthError("Profissional não vinculado", "FORBIDDEN");
    return {
      kind,
      data: await getProfessionalDashboard(ctx.organizationId, prof.id, y, m),
      professionalId: prof.id,
    };
  }

  await requireBi(ctx);
  return {
    kind: "executive" as const,
    data: await getExecutiveDashboard(ctx.organizationId, y, m, ctx.branchId),
    hideClinical: ctx.role === "FINANCEIRO",
  };
}

export async function reprocessMetricsAction(
  fromIso: string,
  toIso: string,
): Promise<ActionResult<{ daysProcessed: number }>> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    await requireBi(ctx);
    const result = await reprocessMetricsRange(
      ctx.organizationId,
      new Date(fromIso),
      new Date(toIso),
    );
    revalidatePath("/app/dashboard");
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listGoalsAction(year?: number, month?: number) {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  await requireBi(ctx);
  const now = new Date();
  return listGoals(ctx.organizationId, year ?? now.getFullYear(), month ?? now.getMonth() + 1);
}

export async function saveGoalAction(input: {
  professionalId?: string;
  year: number;
  month: number;
  goalType: "REVENUE" | "APPOINTMENTS" | "NEW_PATIENTS" | "NPS";
  targetValue: number;
}): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    await upsertGoal({ organizationId: ctx.organizationId, ...input });
    revalidatePath("/app/metas");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function getGoalProgressAction(goalId: string) {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  return getGoalProgress(ctx.organizationId, goalId);
}

export async function listNotificationsAction() {
  const ctx = await requireAuth();
  return listNotifications(ctx.organizationId, ctx.userId);
}

export async function unreadCountAction() {
  const ctx = await requireAuth();
  return countUnread(ctx.organizationId, ctx.userId);
}

export async function markNotificationReadAction(id: string) {
  const ctx = await requireAuth();
  await markRead(id, ctx.organizationId, ctx.userId);
  return { ok: true };
}

export async function markAllNotificationsReadAction() {
  const ctx = await requireAuth();
  await markAllRead(ctx.organizationId, ctx.userId);
  return { ok: true };
}

export async function getNotificationPrefsAction() {
  const ctx = await requireAuth();
  return getNotificationPreferences(ctx.userId, ctx.organizationId);
}

export async function saveNotificationPrefsAction(input: {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled?: boolean;
  pushCategories?: Record<string, boolean>;
}) {
  const ctx = await requireAuth();
  return saveNotificationPreferences(ctx.userId, ctx.organizationId, input);
}

export async function saveReportFiltersAction(reportKey: string, filters: Record<string, unknown>) {
  const ctx = await requireAuth();
  return adminPrisma.userReportPreference.upsert({
    where: {
      userId_organizationId_reportKey: {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        reportKey,
      },
    },
    create: {
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      reportKey,
      filters: filters as Prisma.InputJsonValue,
    },
    update: { filters: filters as Prisma.InputJsonValue },
  });
}

export async function exportExecutivePdfAction(year?: number, month?: number) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  await requireBi(ctx);
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: ctx.organizationId },
  });
  const dash = await getExecutiveDashboard(ctx.organizationId, y, m);
  const pdf = generateReportPdf({
    clinicName: org.name,
    title: `Dashboard executivo — ${m}/${y}`,
    lines: [
      `Atendimentos: ${dash.kpis.completed.value}`,
      `Receita: R$ ${(dash.kpis.revenue.value / 100).toFixed(2)}`,
      `No-show: ${dash.kpis.noShowRate.value}%`,
      `Ocupação: ${dash.kpis.occupation.value}%`,
    ],
  });
  return { pdfBase64: pdf.toString("base64") };
}

export async function getEpidemiologyAction(year?: number, month?: number) {
  const ctx = await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"]);
  await requireBi(ctx);
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  const range = monthRange(y, m);
  return getEpidemiologyReport(ctx.organizationId, range.from, range.to);
}

export async function triggerScheduledReportAction(force = true) {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  await requireBi(ctx);
  const { processScheduledReports } = await import("../services/scheduled-report.service");
  await processScheduledReports(ctx.organizationId, force);
  return { ok: true };
}
