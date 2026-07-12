import type { TenantClient } from "@/lib/db/tenant-client";
import { aiComplete } from "./llm-gateway.service";

export type CollectionRiskResult = {
  score: number;
  factors: { label: string; weight: number }[];
};

export function computeCollectionRisk(input: {
  daysOverdue: number;
  priorLatePayments: number;
  totalReceivables: number;
  amountCents: number;
}): CollectionRiskResult {
  const factors: { label: string; weight: number }[] = [];
  let score = 0;

  if (input.daysOverdue > 30) {
    score += 35;
    factors.push({ label: "Mais de 30 dias em atraso", weight: 35 });
  } else if (input.daysOverdue > 7) {
    score += 20;
    factors.push({ label: "Mais de 7 dias em atraso", weight: 20 });
  }

  if (input.priorLatePayments >= 2) {
    score += 25;
    factors.push({ label: `${input.priorLatePayments} atrasos anteriores`, weight: 25 });
  }

  if (input.amountCents > 50000) {
    score += 10;
    factors.push({ label: "Valor elevado", weight: 10 });
  }

  score = Math.min(100, score);
  return { score, factors };
}

export async function scoreReceivableRisk(db: TenantClient, receivableId: string) {
  const rec = await db.receivable.findFirstOrThrow({
    where: { id: receivableId },
    include: { patient: true },
  });

  const now = new Date();
  const daysOverdue = Math.max(
    0,
    Math.floor((now.getTime() - rec.dueDate.getTime()) / 86400_000),
  );

  const priorLate = await db.receivable.count({
    where: {
      patientId: rec.patientId,
      status: { in: ["ABERTO", "PARCIAL"] },
      dueDate: { lt: now },
      id: { not: rec.id },
    },
  });

  return computeCollectionRisk({
    daysOverdue,
    priorLatePayments: priorLate,
    totalReceivables: 1,
    amountCents: rec.totalCents - rec.paidCents,
  });
}

export async function draftCollectionMessage(
  organizationId: string,
  userId: string,
  templateBody: string,
  context: { patientInitials: string; amountCents: number; daysOverdue: number },
) {
  return aiComplete({
    organizationId,
    userId,
    resource: "SMART_COLLECTION",
    system: `COBRANÇA: personalize dentro do template aprovado. Template base:\n${templateBody}`,
    userMessage: "Gerar mensagem de cobrança",
    context,
  });
}

export async function prioritizeOverdueReceivables(db: TenantClient, limit = 20) {
  const rows = await db.receivable.findMany({
    where: { status: { in: ["ABERTO", "PARCIAL"] }, dueDate: { lt: new Date() } },
    orderBy: { dueDate: "asc" },
    take: limit,
  });

  const scored = await Promise.all(
    rows.map(async (r) => ({
      receivableId: r.id,
      description: r.description,
      risk: await scoreReceivableRisk(db, r.id),
    })),
  );

  return scored.sort((a, b) => b.risk.score - a.risk.score);
}
