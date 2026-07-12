"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { getBillingReportAction } from "@/modules/finance/actions/finance.actions";

export function ReportsPanel() {
  const [report, setReport] = useState<
    Awaited<ReturnType<typeof getBillingReportAction>> | null
  >(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <Button
        disabled={pending}
        onClick={() => {
          const from = new Date();
          from.setMonth(from.getMonth() - 1);
          startTransition(async () => {
            setReport(
              await getBillingReportAction(
                from.toISOString(),
                new Date().toISOString(),
              ),
            );
          });
        }}
      >
        Faturamento (30 dias)
      </Button>
      {report && (
        <div className="text-sm space-y-2">
          <p>Total: {formatBRL(report.totalCents)}</p>
          <p>Ticket médio: {formatBRL(report.ticketMedio)}</p>
          <p>Descontos: {formatBRL(report.discounts)}</p>
          <p>Vendas: {report.count}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const csv = `profissional,valor\n${Object.entries(report.byProfessional)
                .map(([k, v]) => `${k},${v}`)
                .join("\n")}`;
              const blob = new Blob([csv], { type: "text/csv" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "faturamento.csv";
              a.click();
            }}
          >
            Exportar CSV
          </Button>
        </div>
      )}
    </div>
  );
}
