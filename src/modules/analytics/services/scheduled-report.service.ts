import { adminPrisma } from "@/lib/db/admin-client";
import { safeLog } from "@/lib/security/log-redact";
import { formatBRL } from "@/lib/money";
import { toSpDateKey } from "../lib/periods";
import { getExecutiveDashboard } from "./dashboard.service";
import { createNotification, getNotificationPreferences } from "./notification.service";

function spNowParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { hour, dayOfWeek: dowMap[weekday] ?? now.getDay(), dateKey: toSpDateKey(now) };
}

export async function processScheduledReports(organizationId: string, force = false) {
  const { hour, dayOfWeek, dateKey } = spNowParts();
  const reports = await adminPrisma.scheduledReport.findMany({
    where: { organizationId, isActive: true },
  });

  for (const report of reports) {
    if (!force && (report.cronDayOfWeek !== dayOfWeek || report.cronHour !== hour)) continue;

    const weekKey = `${dateKey.slice(0, 7)}-W${Math.ceil(Number(dateKey.slice(8)) / 7)}`;
    if (
      !force &&
      report.lastSentAt &&
      report.lastSentAt.toISOString().slice(0, 7) === dateKey.slice(0, 7) &&
      Math.abs(report.lastSentAt.getTime() - Date.now()) < 6 * 86400_000
    ) {
      continue;
    }

    const org = await adminPrisma.organization.findFirstOrThrow({
      where: { id: organizationId },
    });
    const now = new Date();
    const dash = await getExecutiveDashboard(organizationId, now.getFullYear(), now.getMonth() + 1);
    const body = [
      `Resumo semanal — ${org.name}`,
      `Atendimentos: ${dash.kpis.completed.value} (${dash.kpis.completed.changePct ?? 0}% vs mês ant.)`,
      `Receita: ${formatBRL(dash.kpis.revenue.value)}`,
      `Ocupação: ${dash.kpis.occupation.value}%`,
    ].join("\n");

    const members = await adminPrisma.membership.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(report.recipientRole ? { role: report.recipientRole } : {}),
        ...(report.recipientUserId ? { userId: report.recipientUserId } : {}),
      },
      select: { userId: true, user: { select: { email: true } } },
    });

    for (const m of members) {
      await createNotification({
        organizationId,
        userId: m.userId,
        type: "SYSTEM",
        title: "Resumo semanal",
        body,
        metadata: { reportKey: report.reportKey, weekKey },
      });

      const prefs = await getNotificationPreferences(m.userId, organizationId);
      if (prefs.emailEnabled) {
        safeLog("Vital8 Report Email", `${m.user.email}: ${body.replace(/\n/g, " | ")}`);
      }
    }

    await adminPrisma.scheduledReport.update({
      where: { id: report.id },
      data: { lastSentAt: new Date() },
    });
  }
}
