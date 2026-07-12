"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  getEpidemiologyAction,
  saveReportFiltersAction,
} from "@/modules/analytics/actions/analytics.actions";
import { downloadCsv } from "@/modules/analytics/lib/csv-export";

export function EpidemiologyReportClient() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getEpidemiologyAction>>>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      await saveReportFiltersAction("epidemiologia", { year: 2026, month: 7 });
      setRows(await getEpidemiologyAction(2026, 7));
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            downloadCsv(
              rows.map((r) => ({ cid: r.code, descricao: r.description, casos: r.count })),
              "epidemiologia.csv",
            )
          }
        >
          Exportar CSV
        </Button>
      </div>
      <p className="text-xs text-zinc-500">
        Dados agregados e anonimizados — sem identificação de pacientes.
      </p>
      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-zinc-50 text-left">
            <th className="p-2">CID</th>
            <th className="p-2">Descrição</th>
            <th className="p-2">Casos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-t">
              <td className="p-2 font-mono">{r.code}</td>
              <td className="p-2">{r.description}</td>
              <td className="p-2">{r.count}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="p-4 text-zinc-500">
                Sem registros no período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
