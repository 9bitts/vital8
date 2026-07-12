import type { TenantClient } from "@/lib/db/tenant-client";

export async function getTissIndicators(db: TenantClient) {
  const guides = await db.tissGuide.findMany({
    include: { healthInsurer: true, glosaItems: true },
  });

  const batches = await db.tissBatch.findMany({
    include: { healthInsurer: true, insurerPayments: true, receivable: true },
  });

  const glosaByInsurer = new Map<string, { total: number; glosed: number }>();
  for (const g of guides) {
    const key = g.healthInsurer.name;
    const entry = glosaByInsurer.get(key) ?? { total: 0, glosed: 0 };
    entry.total += g.totalValueCents;
    entry.glosed += g.glosaItems.reduce((s, gi) => s + gi.glosedAmountCents, 0);
    glosaByInsurer.set(key, entry);
  }

  const glosaPercentByInsurer = Array.from(glosaByInsurer.entries()).map(
    ([insurer, { total, glosed }]) => ({
      insurer,
      glosaPercent: total > 0 ? Math.round((glosed / total) * 10000) / 100 : 0,
    }),
  );

  const paymentTerms = batches
    .filter((b) => b.sentAt && b.insurerPayments[0])
    .map((b) => {
      const sent = b.sentAt!.getTime();
      const paid = b.insurerPayments[0]!.paymentDate.getTime();
      const days = Math.round((paid - sent) / (1000 * 60 * 60 * 24));
      return {
        insurer: b.healthInsurer.name,
        actualDays: days,
        contractedDays: b.healthInsurer.paymentTermDays,
      };
    });

  const avgPaymentDays =
    paymentTerms.length > 0
      ? Math.round(
          paymentTerms.reduce((s, p) => s + p.actualDays, 0) / paymentTerms.length,
        )
      : 0;

  const byCompetence = new Map<string, { billed: number; received: number }>();
  for (const g of guides) {
    if (g.status === "ENVIADA" || g.status === "PAGA" || g.status.startsWith("GLOSADA")) {
      const e = byCompetence.get(g.competence) ?? { billed: 0, received: 0 };
      e.billed += g.totalValueCents;
      if (g.status === "PAGA" || g.status === "GLOSADA_PARCIAL") {
        e.received += g.totalValueCents - g.glosaItems.reduce((s, gi) => s + gi.glosedAmountCents, 0);
      }
      byCompetence.set(g.competence, e);
    }
  }

  const pendingGuides = guides.filter(
    (g) => g.status === "RASCUNHO" || (g.validationErrors as unknown[]).length > 0,
  ).length;

  return {
    glosaPercentByInsurer,
    paymentTerms,
    avgPaymentDays,
    productionByCompetence: Array.from(byCompetence.entries()).map(([competence, v]) => ({
      competence,
      ...v,
    })),
    pendingGuides,
  };
}
