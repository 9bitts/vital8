import type { TenantClient } from "@/lib/db/tenant-client";
import { getReactivationReport, type ReactivationReport } from "./reactivation.service";

export type MarketingDashboardMetrics = {
  leadsByStatus: Record<string, number>;
  leadsByChannel: Array<{ channel: string; count: number }>;
  funnelConversion: Array<{ from: string; to: string; rate: number }>;
  avgResponseMinutes: number;
  cacByChannel: Array<{ channel: string; cacCents: number; converted: number }>;
  ltvByCohort: Array<{ cohort: string; ltvCents: number; patients: number }>;
  campaignRoi: Array<{
    campaignId: string;
    name: string;
    investmentCents: number;
    revenueCents: number;
    roiPct: number;
  }>;
  referralRanking: Array<{ patientId: string; name: string; count: number }>;
  newVsReturningRevenue: { newCents: number; returningCents: number };
  reactivation: ReactivationReport;
};

/** CAC = investimento ÷ pacientes convertidos no canal (dataset determinístico para testes). */
export function calculateCac(investmentCents: number, convertedPatients: number): number {
  if (convertedPatients <= 0) return 0;
  return Math.round(investmentCents / convertedPatients);
}

/** LTV = receita total da coorte ÷ pacientes da coorte. */
export function calculateLtv(revenueCents: number, patientCount: number): number {
  if (patientCount <= 0) return 0;
  return Math.round(revenueCents / patientCount);
}

/** ROI = ((receita - investimento) / investimento) × 100 */
export function calculateRoi(revenueCents: number, investmentCents: number): number {
  if (investmentCents <= 0) return 0;
  return Math.round(((revenueCents - investmentCents) / investmentCents) * 100);
}

export function funnelStepRate(fromCount: number, toCount: number): number {
  if (fromCount <= 0) return 0;
  return Math.round((toCount / fromCount) * 100);
}

export async function getMarketingDashboard(
  db: TenantClient,
  organizationId: string,
): Promise<MarketingDashboardMetrics> {
  const leads = await db.lead.findMany({ where: { organizationId } });
  const campaigns = await db.marketingCampaign.findMany({ where: { organizationId } });
  const sources = await db.leadSource.findMany({ where: { organizationId } });

  const leadsByStatus: Record<string, number> = {};
  for (const s of [
    "NOVO",
    "EM_CONTATO",
    "AGENDOU",
    "COMPARECEU",
    "CONVERTIDO",
    "PERDIDO",
  ]) {
    leadsByStatus[s] = leads.filter((l) => l.status === s).length;
  }

  const leadsByChannel = sources.map((src) => ({
    channel: src.name,
    count: leads.filter((l) => l.leadSourceId === src.id).length,
  }));

  const novo = leadsByStatus.NOVO ?? 0;
  const contato = leadsByStatus.EM_CONTATO ?? 0;
  const agendou = leadsByStatus.AGENDOU ?? 0;
  const compareceu = leadsByStatus.COMPARECEU ?? 0;
  const convertido = leadsByStatus.CONVERTIDO ?? 0;

  const funnelConversion = [
    { from: "NOVO", to: "EM_CONTATO", rate: funnelStepRate(novo, contato) },
    { from: "EM_CONTATO", to: "AGENDOU", rate: funnelStepRate(contato, agendou) },
    { from: "AGENDOU", to: "COMPARECEU", rate: funnelStepRate(agendou, compareceu) },
    { from: "COMPARECEU", to: "CONVERTIDO", rate: funnelStepRate(compareceu, convertido) },
  ];

  const convertedPatients = await db.patient.findMany({
    where: { organizationId, marketingCampaignId: { not: null } },
    include: { sales: { select: { totalCents: true } } },
  });

  const cacByChannel = await Promise.all(
    campaigns.map(async (c) => {
      const converted = convertedPatients.filter((p) => p.marketingCampaignId === c.id).length;
      return {
        channel: c.name,
        cacCents: calculateCac(c.investmentCents, converted),
        converted,
      };
    }),
  );

  const cohortMap = new Map<string, { revenue: number; count: number }>();
  for (const p of convertedPatients) {
    const key = p.utmCampaign ?? p.utmSource ?? "direto";
    const rev = p.sales.reduce((s, sale) => s + sale.totalCents, 0);
    const cur = cohortMap.get(key) ?? { revenue: 0, count: 0 };
    cur.revenue += rev;
    cur.count += 1;
    cohortMap.set(key, cur);
  }

  const ltvByCohort = Array.from(cohortMap.entries()).map(([cohort, v]) => ({
    cohort,
    ltvCents: calculateLtv(v.revenue, v.count),
    patients: v.count,
  }));

  const campaignRoi = campaigns.map((c) => {
    const pts = convertedPatients.filter((p) => p.marketingCampaignId === c.id);
    const revenueCents = pts.reduce(
      (s, p) => s + p.sales.reduce((ss, sale) => ss + sale.totalCents, 0),
      0,
    );
    return {
      campaignId: c.id,
      name: c.name,
      investmentCents: c.investmentCents,
      revenueCents,
      roiPct: calculateRoi(revenueCents, c.investmentCents),
    };
  });

  const referrals = await db.referral.findMany({
    where: { organizationId, status: "PREMIADA" },
    include: { referrerPatient: { select: { id: true, fullName: true } } },
  });
  const refMap = new Map<string, { name: string; count: number }>();
  for (const r of referrals) {
    const cur = refMap.get(r.referrerPatientId) ?? {
      name: r.referrerPatient.fullName,
      count: 0,
    };
    cur.count += 1;
    refMap.set(r.referrerPatientId, cur);
  }
  const referralRanking = Array.from(refMap.entries())
    .map(([patientId, v]) => ({ patientId, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count);

  const allPatients = await db.patient.findMany({
    where: { organizationId },
    include: { sales: { select: { totalCents: true, createdAt: true } } },
  });
  let newCents = 0;
  let returningCents = 0;
  for (const p of allPatients) {
    const sales = p.sales.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    sales.forEach((sale, i) => {
      if (i === 0) newCents += sale.totalCents;
      else returningCents += sale.totalCents;
    });
  }

  const withResponse = leads.filter((l) => l.lastContactAt);
  const avgResponseMinutes =
    withResponse.length > 0
      ? Math.round(
          withResponse.reduce((s, l) => {
            const diff = (l.lastContactAt!.getTime() - l.createdAt.getTime()) / 60_000;
            return s + diff;
          }, 0) / withResponse.length,
        )
      : 0;

  const reactivation = await getReactivationReport(db, organizationId, 6);

  return {
    leadsByStatus,
    leadsByChannel,
    funnelConversion,
    avgResponseMinutes,
    cacByChannel,
    ltvByCohort,
    campaignRoi,
    referralRanking,
    newVsReturningRevenue: { newCents, returningCents },
    reactivation,
  };
}
