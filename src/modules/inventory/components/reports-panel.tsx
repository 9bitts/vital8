"use client";

import { formatBRL } from "@/lib/money";

type Props = {
  reports: Awaited<
    ReturnType<typeof import("@/modules/inventory/actions/inventory.actions").getReportsAction>
  >;
  controlledBook?: Awaited<
    ReturnType<typeof import("@/modules/inventory/actions/inventory.actions").getControlledBookAction>
  >;
};

export function ReportsPanel({ reports, controlledBook }: Props) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-medium mb-2">Curva ABC (valor consumido)</h2>
        <table className="w-full text-sm border">
          <thead className="bg-zinc-50">
            <tr>
              <th className="p-2 text-left">Produto</th>
              <th className="p-2 text-right">Valor</th>
              <th className="p-2 text-right">%</th>
              <th className="p-2">Classe</th>
            </tr>
          </thead>
          <tbody>
            {reports.abc.map((r) => (
              <tr key={r.productId} className="border-t">
                <td className="p-2">{r.name}</td>
                <td className="p-2 text-right">{formatBRL(r.valueCents)}</td>
                <td className="p-2 text-right">{r.pct.toFixed(1)}%</td>
                <td className="p-2">{r.class}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-medium mb-2">Perdas por motivo</h2>
        <ul className="text-sm space-y-1">
          {reports.losses.map((l) => (
            <li key={l.reason}>
              {l.reason}: {formatBRL(l.totalCents)} ({l.count} mov.)
            </li>
          ))}
        </ul>
      </section>

      {controlledBook && controlledBook.length > 0 && (
        <section>
          <h2 className="font-medium mb-2">Livro de controlados (344)</h2>
          <table className="w-full text-xs border">
            <thead className="bg-zinc-50">
              <tr>
                <th className="p-1">Data</th>
                <th className="p-1">Produto</th>
                <th className="p-1">Lote</th>
                <th className="p-1">Mov.</th>
                <th className="p-1">Saldo ant.</th>
                <th className="p-1">Saldo pos.</th>
              </tr>
            </thead>
            <tbody>
              {controlledBook.map((l, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1">{l.date.toISOString().slice(0, 10)}</td>
                  <td className="p-1">{l.product}</td>
                  <td className="p-1">{l.batchNumber}</td>
                  <td className="p-1">{l.movementType}</td>
                  <td className="p-1">{l.balanceBefore}</td>
                  <td className="p-1">{l.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
