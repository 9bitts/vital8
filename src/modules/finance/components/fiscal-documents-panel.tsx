"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/money";
import { documentTypeLabel } from "@/modules/finance/services/receita-saude.service";
import {
  exportCarnêLeaoAction,
  manualEmitFiscalDocumentAction,
  processFiscalQueueAction,
  retryFiscalDocumentAction,
} from "@/modules/finance/actions/fiscal.actions";

type Doc = Awaited<
  ReturnType<typeof import("@/modules/finance/actions/fiscal.actions").listFiscalDocumentsAction>
>[number];

type Props = { documents: Doc[] };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  ISSUED: "Emitido",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  REPLACED: "Substituído",
};

export function FiscalDocumentsPanel({ documents }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">ID pagamento</Label>
            <Input value={paymentId} onChange={(e) => setPaymentId(e.target.value)} />
          </div>
          <Button
            size="sm"
            disabled={pending || !paymentId}
            onClick={() =>
              startTransition(async () => {
                const r = await manualEmitFiscalDocumentAction({ paymentId });
                setMessage(
                  r.success ? `Documento ${r.data!.documentId}` : ("error" in r ? r.error : "Erro"),
                );
              })
            }
          >
            Emitir manual
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await processFiscalQueueAction();
              setMessage(
                r.success
                  ? `Fila: ${r.data!.processed} proc., ${r.data!.issued} emitidos`
                  : ("error" in r ? r.error : "Erro"),
              );
            })
          }
        >
          Processar fila
        </Button>
      </div>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-medium">Relatório carnê-leão (Receita Saúde)</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label className="text-xs">Mês</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={reportMonth}
              onChange={(e) => setReportMonth(Number(e.target.value))}
            />
          </div>
          <div>
            <Label className="text-xs">Ano</Label>
            <Input
              type="number"
              value={reportYear}
              onChange={(e) => setReportYear(Number(e.target.value))}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await exportCarnêLeaoAction({
                  year: reportYear,
                  month: reportMonth,
                });
                if (r.success) {
                  const blob = new Blob([r.data!.csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `carne-leao-${reportYear}-${reportMonth}.csv`;
                  a.click();
                  setMessage(`${r.data!.count} recibos — ${formatBRL(r.data!.totalCents)}`);
                } else {
                  setMessage("error" in r ? r.error : "Erro");
                }
              })
            }
          >
            Exportar CSV
          </Button>
        </div>
      </section>

      <div className="rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left">
            <tr>
              <th className="p-2">Tipo</th>
              <th className="p-2">Paciente</th>
              <th className="p-2">Valor</th>
              <th className="p-2">Status</th>
              <th className="p-2">Número</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="p-2">{documentTypeLabel(d.documentType)}</td>
                <td className="p-2">{d.patient.socialName ?? d.patient.fullName}</td>
                <td className="p-2">{formatBRL(d.amountCents)}</td>
                <td className="p-2">{STATUS_LABEL[d.status] ?? d.status}</td>
                <td className="p-2 font-mono text-xs">{d.number ?? "—"}</td>
                <td className="p-2">
                  {(d.status === "FAILED" || d.status === "PENDING") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await retryFiscalDocumentAction(d.id);
                          setMessage(r.success ? "Reprocessado" : ("error" in r ? r.error : "Erro"));
                        })
                      }
                    >
                      Retry
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-zinc-500 text-center">
                  Nenhum documento fiscal emitido.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {message && <p className="text-sm text-green-700">{message}</p>}
    </div>
  );
}
