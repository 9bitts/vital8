"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { getFinanceDashboardAction } from "@/modules/finance/actions/finance.actions";

export function FinanceDashboard() {
  const [data, setData] = useState<
    Awaited<ReturnType<typeof getFinanceDashboardAction>> | null
  >(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setData(await getFinanceDashboardAction());
    });
  }, []);

  if (!data) return <p className="text-sm text-zinc-500">Carregando…</p>;

  const cards = [
    { label: "A receber hoje", value: data.receivableTodayCents },
    { label: "A receber (7 dias)", value: data.receivableWeekCents },
    { label: "Vencidos", value: data.overdueCents },
    { label: "Recebido no mês", value: data.receivedMonthCents },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link href="/app/financeiro/caixa"><Button variant="outline" size="sm">Caixa</Button></Link>
        <Link href="/app/financeiro/receber"><Button variant="outline" size="sm">Contas a receber</Button></Link>
        <Link href="/app/financeiro/pagar"><Button variant="outline" size="sm">Contas a pagar</Button></Link>
        <Link href="/app/financeiro/fluxo"><Button variant="outline" size="sm">Fluxo de caixa</Button></Link>
        <Link href="/app/financeiro/dre"><Button variant="outline" size="sm">DRE</Button></Link>
        <Link href="/app/financeiro/repasse"><Button variant="outline" size="sm">Repasse</Button></Link>
        <Link href="/app/financeiro/pacotes"><Button variant="outline" size="sm">Pacotes</Button></Link>
        <Link href="/app/financeiro/relatorios"><Button variant="outline" size="sm">Relatórios</Button></Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-white p-4">
            <p className="text-sm text-zinc-500">{c.label}</p>
            <p className="text-2xl font-semibold">{formatBRL(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="font-medium mb-2">Caixa aberto</h2>
        {data.openRegister ? (
          <p className="text-sm">
            Aberto desde {data.openRegister.openedAt.toLocaleString("pt-BR")} — fundo{" "}
            {formatBRL(data.openRegister.openingAmountCents)}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">Nenhum caixa aberto.</p>
        )}
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="font-medium mb-2">Contas a pagar (7 dias)</h2>
        <ul className="text-sm space-y-1">
          {data.upcomingPayables.map((p) => (
            <li key={p.id}>
              {p.description} — {formatBRL(p.amountCents)} —{" "}
              {new Date(p.dueDate).toLocaleDateString("pt-BR")}
            </li>
          ))}
          {data.upcomingPayables.length === 0 && (
            <li className="text-zinc-400">Nenhuma conta próxima.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
