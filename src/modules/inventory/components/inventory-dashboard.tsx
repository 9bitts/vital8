"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/money";

type Props = {
  summary: Awaited<
    ReturnType<typeof import("@/modules/inventory/actions/inventory.actions").getDashboardAction>
  >;
};

export function InventoryDashboard({ summary }: Props) {
  const { alerts, movements, totalValueCents } = summary;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded border p-3">
          <div className="text-xs text-zinc-500">Valor em estoque</div>
          <div className="text-2xl font-semibold">{formatBRL(totalValueCents)}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-zinc-500">Abaixo do mínimo</div>
          <div className="text-2xl font-semibold text-amber-700">
            {alerts.belowMin.length}
          </div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-zinc-500">Lotes vencendo</div>
          <div className="text-2xl font-semibold text-red-700">
            {alerts.expiring.length}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/app/estoque/produtos" className="underline text-blue-600">Produtos</Link>
        <Link href="/app/estoque/movimentacoes" className="underline text-blue-600">Movimentações</Link>
        <Link href="/app/estoque/compras" className="underline text-blue-600">Compras</Link>
        <Link href="/app/estoque/inventario" className="underline text-blue-600">Inventário</Link>
        <Link href="/app/estoque/relatorios" className="underline text-blue-600">Relatórios</Link>
        <Link href="/app/configuracoes/servicos" className="underline text-blue-600">Kits por serviço</Link>
      </div>

      {alerts.belowMin.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <h3 className="font-medium text-amber-900">Alertas — estoque mínimo</h3>
          <ul className="text-sm mt-2 space-y-1">
            {alerts.belowMin.map((a) => (
              <li key={a.product.id}>
                {a.product.name}: {a.qty} / mín {a.minStock}
              </li>
            ))}
          </ul>
        </div>
      )}

      {alerts.expiring.length > 0 && (
        <div className="rounded border border-red-200 bg-red-50 p-3">
          <h3 className="font-medium text-red-900">Validade próxima</h3>
          <ul className="text-sm mt-2 space-y-1">
            {alerts.expiring.slice(0, 10).map((e) => (
              <li key={e.batch.id}>
                {e.product.name} — lote {e.batch.batchNumber} ({e.daysUntilExpiry}d)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="font-medium mb-2">Últimos movimentos</h2>
        <div className="rounded border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Produto</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-right">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-2">{m.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td className="p-2">{m.product.name}</td>
                  <td className="p-2"><Badge variant="secondary">{m.movementType}</Badge></td>
                  <td className="p-2 text-right">{m.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
