"use client";

import { formatBRL } from "@/lib/money";
import type { MarketingDashboardMetrics } from "../services/roi.service";

export function MarketingDashboardPanel({ data }: { data: MarketingDashboardMetrics }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(data.leadsByStatus).map(([status, count]) => (
          <div key={status} className="rounded border p-4">
            <p className="text-xs text-zinc-500">{status}</p>
            <p className="text-2xl font-semibold">{count}</p>
          </div>
        ))}
      </div>

      <section>
        <h3 className="mb-2 font-medium">Funil</h3>
        <ul className="space-y-1 text-sm">
          {data.funnelConversion.map((s) => (
            <li key={`${s.from}-${s.to}`}>
              {s.from} → {s.to}: {s.rate}%
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-zinc-500">
          Tempo médio de resposta: {data.avgResponseMinutes} min
        </p>
      </section>

      <section>
        <h3 className="mb-2 font-medium">CAC por canal</h3>
        <ul className="text-sm space-y-1">
          {data.cacByChannel.map((c) => (
            <li key={c.channel}>
              {c.channel}: {formatBRL(c.cacCents)} ({c.converted} convertidos)
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-medium">ROI por campanha</h3>
        <ul className="text-sm space-y-1">
          {data.campaignRoi.map((c) => (
            <li key={c.campaignId}>
              {c.name}: invest. {formatBRL(c.investmentCents)} · receita{" "}
              {formatBRL(c.revenueCents)} · ROI {c.roiPct}%
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-medium">LTV por coorte</h3>
        <ul className="text-sm space-y-1">
          {data.ltvByCohort.map((c) => (
            <li key={c.cohort}>
              {c.cohort}: {formatBRL(c.ltvCents)} ({c.patients} pacientes)
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-medium">Reativação (6+ meses sem atendimento)</h3>
        <p className="text-sm">
          Inativos: {data.reactivation.totalInactive} · Contatados: {data.reactivation.contacted} ·
          Retornaram: {data.reactivation.returned}
        </p>
        <ul className="mt-2 text-sm space-y-1">
          {data.reactivation.patients.slice(0, 5).map((p) => (
            <li key={p.patientId}>
              {p.fullName} — {p.monthsInactive} meses
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-medium">Receita novos × recorrentes</h3>
        <p className="text-sm">
          Novos: {formatBRL(data.newVsReturningRevenue.newCents)} · Recorrentes:{" "}
          {formatBRL(data.newVsReturningRevenue.returningCents)}
        </p>
      </section>
    </div>
  );
}
