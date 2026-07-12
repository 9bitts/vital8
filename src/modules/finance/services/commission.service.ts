import type {
  CommissionBase,
  CommissionRuleType,
} from "@/generated/prisma/client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { allocateDiscount, sumCents } from "@/lib/money";

export type CommissionLine = {
  saleId: string;
  paymentId?: string;
  description: string;
  baseCents: number;
  commissionCents: number;
};

export function calculateCommissionForLine(
  baseCents: number,
  ruleType: CommissionRuleType,
  value: number,
): number {
  if (baseCents <= 0) return 0;
  if (ruleType === "PERCENTUAL") {
    return Math.round((baseCents * value) / 10000);
  }
  return value;
}

export function computeCommissionLines(
  sales: Array<{
    id: string;
    totalCents: number;
    discountCents: number;
    subtotalCents: number;
    professionalId: string | null;
    isPrivate: boolean;
    serviceId: string | null;
    payments: Array<{ id: string; amountCents: number; netAmountCents: number }>;
  }>,
  rules: Array<{
    professionalId: string;
    serviceId: string | null;
    ruleType: CommissionRuleType;
    value: number;
    base: CommissionBase;
    isPrivate: boolean | null;
  }>,
): CommissionLine[] {
  const lines: CommissionLine[] = [];

  for (const sale of sales) {
    if (!sale.professionalId) continue;

    const rule = rules.find(
      (r) =>
        r.professionalId === sale.professionalId &&
        (r.serviceId === null || r.serviceId === sale.serviceId) &&
        (r.isPrivate === null || r.isPrivate === sale.isPrivate),
    );
    if (!rule) continue;

    const netBase = sale.totalCents;

    if (rule.base === "FATURADO") {
      const commissionCents = calculateCommissionForLine(
        netBase,
        rule.ruleType,
        rule.value,
      );
      lines.push({
        saleId: sale.id,
        description: `Venda ${sale.id.slice(-6)} (faturado)`,
        baseCents: netBase,
        commissionCents,
      });
    } else {
      for (const payment of sale.payments) {
        const payBase = payment.netAmountCents;
        const commissionCents = calculateCommissionForLine(
          payBase,
          rule.ruleType,
          rule.value,
        );
        lines.push({
          saleId: sale.id,
          paymentId: payment.id,
          description: `Pagamento ${payment.id.slice(-6)} (recebido)`,
          baseCents: payBase,
          commissionCents,
        });
      }
    }
  }

  return lines;
}

export async function accrueCommissionStatement(
  db: TenantClient,
  organizationId: string,
  professionalId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const existingClosed = await db.commissionStatement.findFirst({
    where: {
      professionalId,
      periodStart,
      periodEnd,
      status: { in: ["FECHADO", "PAGO"] },
    },
  });
  if (existingClosed) {
    throw new Error("Período já fechado");
  }

  const sales = await db.sale.findMany({
    where: {
      professionalId,
      status: "CONFIRMADA",
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    include: {
      items: true,
      payments: true,
      patient: true,
    },
  });

  const rules = await db.commissionRule.findMany({
    where: { professionalId, isActive: true },
  });

  const saleInputs = sales.map((s) => ({
    id: s.id,
    totalCents: s.totalCents,
    discountCents: s.discountCents,
    subtotalCents: s.subtotalCents,
    professionalId: s.professionalId,
    isPrivate: true,
    serviceId: s.items[0]?.serviceId ?? null,
    payments: s.payments.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      netAmountCents: p.netAmountCents,
    })),
  }));

  const lines = computeCommissionLines(saleInputs, rules);
  const totalCents = sumCents(lines.map((l) => l.commissionCents));

  let statement = await db.commissionStatement.findFirst({
    where: { professionalId, periodStart, periodEnd },
  });

  if (statement?.status === "FECHADO" || statement?.status === "PAGO") {
    throw new Error("Extrato já fechado");
  }

  if (statement) {
    await db.commissionStatementItem.deleteMany({
      where: { statementId: statement.id },
    });
    statement = await db.commissionStatement.update({
      where: { id: statement.id },
      data: { totalCents },
    });
  } else {
    statement = await db.commissionStatement.create({
      data: {
        organizationId,
        professionalId,
        periodStart,
        periodEnd,
        totalCents,
      },
    });
  }

  if (lines.length > 0) {
    await db.commissionStatementItem.createMany({
      data: lines.map((l) => ({
        organizationId,
        statementId: statement!.id,
        saleId: l.saleId,
        paymentId: l.paymentId ?? null,
        description: l.description,
        baseCents: l.baseCents,
        commissionCents: l.commissionCents,
      })),
    });
  }

  return db.commissionStatement.findFirstOrThrow({
    where: { id: statement!.id },
    include: { items: true, professional: true },
  });
}

export async function closeCommissionStatement(
  db: TenantClient,
  statementId: string,
) {
  const stmt = await db.commissionStatement.findFirstOrThrow({
    where: { id: statementId },
  });
  if (stmt.status !== "ABERTO") {
    throw new Error("Extrato não está aberto");
  }
  return db.commissionStatement.update({
    where: { id: statementId },
    data: { status: "FECHADO", closedAt: new Date() },
  });
}

export function applyDiscountToCommissionBase(
  lineTotalCents: number,
  discountCents: number,
  subtotalCents: number,
): number {
  if (subtotalCents <= 0) return lineTotalCents;
  const [share] = allocateDiscount([lineTotalCents], discountCents);
  return lineTotalCents - share;
}
