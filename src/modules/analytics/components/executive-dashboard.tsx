"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { downloadCsv } from "../lib/csv-export";
import { exportExecutivePdfAction } from "../actions/analytics.actions";
import { MonthlyInsightsCard } from "@/modules/ai/components/monthly-insights-card";

type DashboardData = Awaited<
  ReturnType<typeof import("../actions/analytics.actions").getDashboardAction>
>;

type Props = {
  data: Extract<DashboardData, { kind: "executive" }>["data"];
  hideClinical?: boolean;
};

function KpiCard({
  label,
  value,
  changePct,
  format = "number",
}: {
  label: string;
  value: number | null;
  changePct?: number | null;
  format?: "number" | "currency" | "pct";
}) {
  const display =
    value === null
      ? "—"
      : format === "currency"
        ? formatBRL(value)
        : format === "pct"
          ? `${value}%`
          : String(value);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-600">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{display}</p>
        {changePct != null && (
          <p className={`text-xs ${changePct >= 0 ? "text-green-700" : "text-red-600"}`}>
            {changePct >= 0 ? "+" : ""}
            {changePct}% vs período anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ExecutiveDashboard({ data, hideClinical }: Props) {
  const revenueChart = data.dailyRevenue.map((d) => ({
    ...d,
    revenueBRL: d.revenue / 100,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Atendimentos" value={data.kpis.completed.value} changePct={data.kpis.completed.changePct} />
        <KpiCard label="Receita (caixa)" value={data.kpis.revenue.value} changePct={data.kpis.revenue.changePct} format="currency" />
        <KpiCard label="No-show" value={data.kpis.noShowRate.value} format="pct" />
        <KpiCard label="Ocupação" value={data.kpis.occupation.value} format="pct" />
        {!hideClinical && <KpiCard label="NPS" value={data.kpis.nps.value} />}
      </div>

      <MonthlyInsightsCard
        aggregates={{
          noShowRate: data.kpis.noShowRate.value,
          revenue: data.kpis.revenue.value,
          occupation: data.kpis.occupation.value,
          completed: data.kpis.completed.value,
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Receita diária</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadCsv(
                  data.dailyRevenue.map((d) => ({
                    data: d.date,
                    receita_centavos: d.revenue,
                    atendimentos: d.appointments,
                  })),
                  "receita-diaria.csv",
                )
              }
            >
              CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-64" role="img" aria-label="Gráfico de receita diária">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`R$ ${Number(v ?? 0).toFixed(2)}`, "Receita"]} />
                  <Line type="monotone" dataKey="revenueBRL" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-2 text-sm">
              <summary>Ver dados</summary>
              <table className="w-full mt-2">
                <thead>
                  <tr className="text-left text-zinc-500">
                    <th>Data</th>
                    <th>Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailyRevenue.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{formatBRL(d.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funil do período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { etapa: "Agendado", qtd: data.funnel.scheduled },
                    { etapa: "Confirmado", qtd: data.funnel.confirmed },
                    { etapa: "Atendido", qtd: data.funnel.completed },
                    { etapa: "Pago", qtd: data.funnel.paid },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="etapa" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="qtd" fill="#059669" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking — profissionais</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b">
                <th className="pb-2">Profissional</th>
                <th>Atendimentos</th>
                <th>Ocupação</th>
              </tr>
            </thead>
            <tbody>
              {data.occupationRanking.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100">
                  <td className="py-2">{p.name}</td>
                  <td>{p.completed}</td>
                  <td>{p.occupationPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Projeção linear: {formatBRL(data.projection.revenue)} receita · {data.projection.appointments} atendimentos
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            exportExecutivePdfAction().then((r) => {
              const bytes = Uint8Array.from(atob(r.pdfBase64), (c) => c.charCodeAt(0));
              const blob = new Blob([bytes], { type: "application/pdf" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "dashboard-executivo.pdf";
              a.click();
            })
          }
        >
          PDF
        </Button>
      </div>
    </div>
  );
}
