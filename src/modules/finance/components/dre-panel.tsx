"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { getDreAction } from "@/modules/finance/actions/finance.actions";

export function DrePanel() {
  const [data, setData] = useState<
    Awaited<ReturnType<typeof getDreAction>> | null
  >(null);
  const [pending, startTransition] = useTransition();

  const now = new Date();

  return (
    <div className="space-y-4">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setData(
              await getDreAction(now.getFullYear(), now.getMonth() + 1),
            );
          })
        }
      >
        DRE do mês
      </Button>
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded border p-4">
              <p className="text-sm">Receitas</p>
              <p className="text-xl font-semibold">{formatBRL(data.revenueCents)}</p>
            </div>
            <div className="rounded border p-4">
              <p className="text-sm">Despesas</p>
              <p className="text-xl font-semibold">{formatBRL(data.expenseCents)}</p>
            </div>
            <div className="rounded border p-4">
              <p className="text-sm">Resultado</p>
              <p className="text-xl font-semibold">{formatBRL(data.resultCents)}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const rows = [
                ["Categoria", "Valor"],
                ...Object.entries(data.expenseByCategory).map(([k, v]) => [
                  k,
                  String(v),
                ]),
              ];
              const csv = rows.map((r) => r.join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "dre.csv";
              a.click();
            }}
          >
            Exportar CSV
          </Button>
        </>
      )}
    </div>
  );
}
