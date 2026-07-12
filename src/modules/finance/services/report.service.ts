import type { TenantClient } from "@/lib/db/tenant-client";
import { sumCents } from "@/lib/money";
import { branchFilter } from "@/modules/admin/services/branch.service";

function paymentBranchWhere(branchId: string | null | undefined) {
  if (!branchId) return {};
  return { cashRegister: { branchId } };
}

function saleBranchWhere(branchId: string | null | undefined) {
  if (!branchId) return {};
  return { appointment: { branchId } };
}

function pendingSum(sum: {
  _sum: { totalCents: number | null; paidCents: number | null };
}) {
  return (sum._sum.totalCents ?? 0) - (sum._sum.paidCents ?? 0);
}

export async function getCashFlow(
  db: TenantClient,
  from: Date,
  to: Date,
  branchId?: string | null,
) {
  const payments = await db.payment.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      ...paymentBranchWhere(branchId),
    },
  });

  const receivables = await db.receivable.findMany({
    where: {
      dueDate: { gte: from, lte: to },
      status: { in: ["ABERTO", "PARCIAL", "VENCIDO"] },
      ...(branchId
        ? {
            OR: [
              { sale: saleBranchWhere(branchId) },
              { payments: { some: paymentBranchWhere(branchId) } },
            ],
          }
        : {}),
    },
  });

  const payables = await db.payable.findMany({
    where: {
      dueDate: { gte: from, lte: to },
      status: "ABERTO",
    },
  });

  const realized = sumCents(payments.map((p) => p.netAmountCents));
  const projectedIn = sumCents(
    receivables.map((r) => r.totalCents - r.paidCents),
  );
  const projectedOut = sumCents(payables.map((p) => p.amountCents));

  return {
    realized,
    projectedIn,
    projectedOut,
    projectedBalance: realized + projectedIn - projectedOut,
    payments,
    receivables,
    payables,
  };
}

export async function getDre(
  db: TenantClient,
  year: number,
  month: number,
  branchId?: string | null,
) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const payments = await db.payment.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      ...paymentBranchWhere(branchId),
    },
  });

  const payables = await db.payable.findMany({
    where: {
      competenceDate: { gte: start, lte: end },
      status: "PAGO",
    },
    include: { category: { include: { parent: true } } },
  });

  const revenueCents = sumCents(payments.map((p) => p.netAmountCents));
  const expenseByCategory = new Map<string, number>();

  for (const p of payables) {
    const key = p.category
      ? `${p.category.parent?.name ?? ""} > ${p.category.name}`
      : "Sem categoria";
    expenseByCategory.set(key, (expenseByCategory.get(key) ?? 0) + p.amountCents);
  }

  const expenseCents = sumCents(Array.from(expenseByCategory.values()));

  return {
    revenueCents,
    expenseCents,
    resultCents: revenueCents - expenseCents,
    expenseByCategory: Object.fromEntries(expenseByCategory),
  };
}

export async function getFinanceDashboard(
  db: TenantClient,
  branchId?: string | null,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const receivableBranch = branchId
    ? {
        OR: [
          { sale: saleBranchWhere(branchId) },
          { payments: { some: paymentBranchWhere(branchId) } },
        ],
      }
    : {};

  const [dueToday, dueWeek, overdue, monthPayments, upcomingPayables, openRegister] =
    await Promise.all([
      db.receivable.aggregate({
        where: {
          dueDate: today,
          status: { in: ["ABERTO", "PARCIAL"] },
          ...receivableBranch,
        },
        _sum: { totalCents: true, paidCents: true },
      }),
      db.receivable.aggregate({
        where: {
          dueDate: { gte: today, lte: weekEnd },
          status: { in: ["ABERTO", "PARCIAL"] },
          ...receivableBranch,
        },
        _sum: { totalCents: true, paidCents: true },
      }),
      db.receivable.aggregate({
        where: { status: "VENCIDO", ...receivableBranch },
        _sum: { totalCents: true, paidCents: true },
      }),
      db.payment.aggregate({
        where: {
          createdAt: { gte: monthStart },
          ...paymentBranchWhere(branchId),
        },
        _sum: { netAmountCents: true },
      }),
      db.payable.findMany({
        where: {
          dueDate: { gte: today, lte: weekEnd },
          status: "ABERTO",
        },
        orderBy: { dueDate: "asc" },
        take: 10,
      }),
      db.cashRegister.findFirst({
        where: { status: "ABERTO", ...branchFilter(branchId) },
        include: { entries: true },
      }),
    ]);

  return {
    receivableTodayCents: pendingSum(dueToday),
    receivableWeekCents: pendingSum(dueWeek),
    overdueCents: pendingSum(overdue),
    receivedMonthCents: monthPayments._sum.netAmountCents ?? 0,
    upcomingPayables,
    openRegister,
  };
}

export async function getBillingReport(
  db: TenantClient,
  from: Date,
  to: Date,
  branchId?: string | null,
) {
  const sales = await db.sale.findMany({
    where: {
      status: "CONFIRMADA",
      createdAt: { gte: from, lte: to },
      ...(branchId ? saleBranchWhere(branchId) : {}),
    },
    include: {
      items: { include: { service: true } },
      payments: true,
      professional: true,
      patient: true,
    },
  });

  const byProfessional = new Map<string, number>();
  const byService = new Map<string, number>();
  const byMethod = new Map<string, number>();
  let discounts = 0;

  for (const sale of sales) {
    if (sale.professionalId) {
      byProfessional.set(
        sale.professional?.displayName ?? sale.professionalId,
        (byProfessional.get(sale.professional?.displayName ?? sale.professionalId) ?? 0) +
          sale.totalCents,
      );
    }
    for (const item of sale.items) {
      const name = item.service?.name ?? item.description;
      byService.set(name, (byService.get(name) ?? 0) + item.totalCents);
    }
    discounts += sale.discountCents;
    for (const p of sale.payments) {
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountCents);
    }
  }

  const totalCents = sumCents(sales.map((s) => s.totalCents));
  const ticketMedio = sales.length > 0 ? Math.round(totalCents / sales.length) : 0;

  return {
    totalCents,
    ticketMedio,
    discounts,
    count: sales.length,
    byProfessional: Object.fromEntries(byProfessional),
    byService: Object.fromEntries(byService),
    byMethod: Object.fromEntries(byMethod),
  };
}
