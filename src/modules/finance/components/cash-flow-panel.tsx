"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { getCashFlowAction } from "@/modules/finance/actions/finance.actions";

export function CashFlowPanel() {
  const [data, setData] = useState<
    Awaited<ReturnType<typeof getCashFlowAction>> | null
  >(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <Button
        disabled={pending}
        onClick={() => {
          const from = new Date();
          from.setDate(1);
          const to = new Date();
          to.setMonth(to.getMonth() + 1);
          startTransition(async () => {
            setData(
              await getCashFlowAction(from.toISOString(), to.toISOString()),
            );
          });
        }}
      >
        Carregar mês atual
      </Button>
      {data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded border p-4">
            <p className="text-sm text-zinc-500">Realizado</p>
            <p className="text-xl font-semibold">{formatBRL(data.realized)}</p>
          </div>
          <div className="rounded border p-4">
            <p className="text-sm text-zinc-500">A receber (proj.)</p>
            <p className="text-xl font-semibold">{formatBRL(data.projectedIn)}</p>
          </div>
          <div className="rounded border p-4">
            <p className="text-sm text-zinc-500">A pagar (proj.)</p>
            <p className="text-xl font-semibold">{formatBRL(data.projectedOut)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
