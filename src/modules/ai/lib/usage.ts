import { adminPrisma } from "@/lib/db/admin-client";

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function getMonthlyUsage(organizationId: string) {
  const yearMonth = currentYearMonth();
  return adminPrisma.aiUsageMonthly.upsert({
    where: { organizationId_yearMonth: { organizationId, yearMonth } },
    create: { organizationId, yearMonth, tokensUsed: 0, requestCount: 0 },
    update: {},
  });
}

export async function recordAiUsage(organizationId: string, tokensUsed: number) {
  const yearMonth = currentYearMonth();
  const row = await adminPrisma.aiUsageMonthly.upsert({
    where: { organizationId_yearMonth: { organizationId, yearMonth } },
    create: {
      organizationId,
      yearMonth,
      tokensUsed,
      requestCount: 1,
    },
    update: {
      tokensUsed: { increment: tokensUsed },
      requestCount: { increment: 1 },
    },
  });
  return row;
}

export async function assertWithinUsageLimit(organizationId: string): Promise<void> {
  const settings = await adminPrisma.aiSettings.findUnique({ where: { organizationId } });
  const limit = settings?.monthlyTokenLimit ?? 500_000;
  const usage = await getMonthlyUsage(organizationId);
  if (usage.tokensUsed >= limit) {
    throw new Error("Limite mensal de uso de IA atingido. Contate o administrador.");
  }
  if (usage.tokensUsed >= limit * 0.8 && !settings?.monthlyAlertSentAt) {
    await adminPrisma.aiSettings.update({
      where: { organizationId },
      data: { monthlyAlertSentAt: new Date() },
    });
  }
}

export async function getUsageSummary(organizationId: string) {
  const settings = await adminPrisma.aiSettings.findUnique({ where: { organizationId } });
  const usage = await getMonthlyUsage(organizationId);
  const limit = settings?.monthlyTokenLimit ?? 500_000;
  return {
    tokensUsed: usage.tokensUsed,
    requestCount: usage.requestCount,
    limit,
    percentUsed: Math.round((usage.tokensUsed / limit) * 100),
    alertAt80: usage.tokensUsed >= limit * 0.8,
  };
}
