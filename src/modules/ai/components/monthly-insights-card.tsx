"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMonthlyInsightsAction, explainChartAction } from "@/modules/ai/actions/ai.actions";

type Props = {
  aggregates: {
    noShowRate: number | null;
    revenue: number | null;
    occupation: number | null;
    completed: number | null;
  };
};

export function MonthlyInsightsCard({ aggregates }: Props) {
  const [insights, setInsights] = useState<{ text: string; reportPath?: string }[]>([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadInsights() {
    startTransition(async () => {
      const r = await getMonthlyInsightsAction(aggregates);
      if (r.success && r.data) setInsights(r.data.insights);
    });
  }

  function explain() {
    startTransition(async () => {
      const r = await explainChartAction("Receita diária", aggregates);
      if (r.success && r.data) setExplanation(r.data.text);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Insights do mês (IA)</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadInsights} disabled={pending}>
            Gerar insights
          </Button>
          <Button size="sm" variant="ghost" onClick={explain} disabled={pending}>
            Explicar gráfico
          </Button>
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {insights.length === 0 && !explanation && (
          <p className="text-zinc-500">Sugestões baseadas em agregados — sem PHI.</p>
        )}
        <ul className="list-disc pl-4 space-y-1">
          {insights.map((ins, i) => (
            <li key={i}>
              {ins.text}
              {ins.reportPath && (
                <a href={ins.reportPath} className="ml-2 text-blue-600 underline text-xs">
                  Ver relatório
                </a>
              )}
            </li>
          ))}
        </ul>
        {explanation && (
          <p className="rounded bg-violet-50 p-2 text-xs border border-violet-100">{explanation}</p>
        )}
      </CardContent>
    </Card>
  );
}
