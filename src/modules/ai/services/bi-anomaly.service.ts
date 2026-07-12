import { adminPrisma } from "@/lib/db/admin-client";
import { createNotification } from "@/modules/analytics/services/notification.service";

export function avgDailyRates(
  rows: Array<{
    appointmentsNoShow: number;
    appointmentsScheduled: number;
    slotsAvailable: number;
    slotsOccupied: number;
    glosaCents: number;
  }>,
) {
  if (rows.length === 0) {
    return { noShowRate: 0, occupationRate: 0, avgGlosaCents: 0 };
  }

  let noShowSum = 0;
  let occSum = 0;
  let glosaSum = 0;
  for (const r of rows) {
    noShowSum +=
      r.appointmentsScheduled > 0
        ? r.appointmentsNoShow / r.appointmentsScheduled
        : 0;
    occSum += r.slotsAvailable > 0 ? r.slotsOccupied / r.slotsAvailable : 0;
    glosaSum += r.glosaCents;
  }

  return {
    noShowRate: noShowSum / rows.length,
    occupationRate: occSum / rows.length,
    avgGlosaCents: glosaSum / rows.length,
  };
}

export async function scanBiAnomalies(organizationId: string) {
  const admins = await adminPrisma.membership.findMany({
    where: { organizationId, role: { in: ["OWNER", "ADMIN"] }, isActive: true },
    select: { userId: true },
  });
  if (admins.length === 0) return [];

  const now = new Date();
  const recentEnd = new Date(now);
  recentEnd.setDate(recentEnd.getDate() - 1);
  const recentStart = new Date(now);
  recentStart.setDate(recentStart.getDate() - 8);

  const baselineEnd = new Date(recentStart);
  baselineEnd.setDate(baselineEnd.getDate() - 1);
  const baselineStart = new Date(baselineEnd);
  baselineStart.setDate(baselineStart.getDate() - 28);

  const [recent, baseline] = await Promise.all([
    adminPrisma.dailyOrgMetrics.findMany({
      where: {
        organizationId,
        date: { gte: recentStart, lte: recentEnd },
      },
    }),
    adminPrisma.dailyOrgMetrics.findMany({
      where: {
        organizationId,
        date: { gte: baselineStart, lte: baselineEnd },
      },
    }),
  ]);

  if (recent.length < 3 || baseline.length < 7) return [];

  const recentAgg = avgDailyRates(recent);
  const baselineAgg = avgDailyRates(baseline);
  const recentWeeklyGlosa = recent.reduce((s, r) => s + r.glosaCents, 0);
  const baselineWeeklyGlosa = baselineAgg.avgGlosaCents * 7;
  const anomalies: Array<{ title: string; body: string }> = [];

  if (
    baselineAgg.occupationRate > 0.1 &&
    recentAgg.occupationRate < baselineAgg.occupationRate * 0.75
  ) {
    const drop = Math.round(
      (1 - recentAgg.occupationRate / baselineAgg.occupationRate) * 100,
    );
    anomalies.push({
      title: "Queda de ocupação detectada",
      body: `Ocupação caiu ~${drop}% na última semana vs. média do mês anterior.`,
    });
  }

  if (
    baselineAgg.noShowRate > 0 &&
    recentAgg.noShowRate > baselineAgg.noShowRate * 1.4 &&
    recentAgg.noShowRate > 0.08
  ) {
    anomalies.push({
      title: "Aumento de no-show",
      body: `Taxa de falta subiu para ${(recentAgg.noShowRate * 100).toFixed(0)}% (média anterior ${(baselineAgg.noShowRate * 100).toFixed(0)}%).`,
    });
  }

  if (
    baselineWeeklyGlosa > 0 &&
    recentWeeklyGlosa > baselineWeeklyGlosa * 1.5
  ) {
    anomalies.push({
      title: "Glosa acima da média",
      body: `Glosas na semana: R$ ${(recentWeeklyGlosa / 100).toFixed(2)} vs. média semanal R$ ${(baselineWeeklyGlosa / 100).toFixed(2)}.`,
    });
  }

  const created = [];
  for (const a of anomalies) {
    for (const admin of admins) {
      const existing = await adminPrisma.userNotification.findFirst({
        where: {
          organizationId,
          userId: admin.userId,
          type: "BI_ANOMALY",
          title: a.title,
          createdAt: { gte: recentStart },
        },
      });
      if (existing) continue;

      const n = await createNotification({
        organizationId,
        userId: admin.userId,
        type: "BI_ANOMALY",
        title: a.title,
        body: a.body,
        metadata: { source: "bi-anomaly-scanner" },
      });
      created.push(n);
    }
  }

  return created;
}
