import { aiComplete } from "./llm-gateway.service";

export async function generateMonthlyInsights(
  organizationId: string,
  userId: string,
  aggregates: {
    noShowRate: number | null;
    revenue: number | null;
    occupation: number | null;
    completed: number | null;
    weekdayNoShow?: Record<string, number>;
  },
) {
  const { text, logId } = await aiComplete({
    organizationId,
    userId,
    resource: "BI_INSIGHTS",
    system: "INSIGHT: gere 3-5 observações sobre KPIs agregados em JSON {insights:[{text, reportPath}]}",
    userMessage: JSON.stringify(aggregates),
    skipMinimize: true,
  });

  try {
    const parsed = JSON.parse(text) as {
      insights: { text: string; reportPath?: string }[];
    };
    return { insights: parsed.insights.slice(0, 5), logId };
  } catch {
    return {
      insights: [{ text, reportPath: "/app/dashboard" }],
      logId,
    };
  }
}

export async function explainChart(
  organizationId: string,
  userId: string,
  chartTitle: string,
  series: unknown,
) {
  return aiComplete({
    organizationId,
    userId,
    resource: "BI_INSIGHTS",
    system: "Explique o gráfico em linguagem executiva, 2-3 frases.",
    userMessage: chartTitle,
    context: { series },
    skipMinimize: true,
  });
}
