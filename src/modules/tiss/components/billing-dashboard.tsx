"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/money";
import {
  closeBatchAction,
  createBatchAction,
  downloadBatchXmlAction,
  listBatchesAction,
  listGuidesAction,
  revalidateGuideAction,
  sendBatchAction,
} from "@/modules/tiss/actions/tiss.actions";

type Guide = Awaited<ReturnType<typeof listGuidesAction>>[number];
type Batch = Awaited<ReturnType<typeof listBatchesAction>>[number];
type Insurer = { id: string; name: string };

type Props = {
  insurers: Insurer[];
  initialGuides: Guide[];
  initialBatches: Batch[];
  indicators: Awaited<
    ReturnType<typeof import("@/modules/tiss/actions/tiss.actions").getIndicatorsAction>
  >;
};

export function BillingDashboard({
  insurers,
  initialGuides,
  initialBatches,
  indicators,
}: Props) {
  const [guides, setGuides] = useState(initialGuides);
  const [batches, setBatches] = useState(initialBatches);
  const [competence, setCompetence] = useState("");
  const [insurerId, setInsurerId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    return guides.filter((g) => {
      if (competence && g.competence !== competence) return false;
      if (insurerId && g.healthInsurerId !== insurerId) return false;
      return true;
    });
  }, [guides, competence, insurerId]);

  function refresh() {
    startTransition(async () => {
      const [g, b] = await Promise.all([
        listGuidesAction({ competence: competence || undefined, healthInsurerId: insurerId || undefined }),
        listBatchesAction(insurerId || undefined),
      ]);
      setGuides(g);
      setBatches(b);
    });
  }

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded border p-3">
          <div className="text-xs text-zinc-500">Guias pendentes</div>
          <div className="text-2xl font-semibold">{indicators.pendingGuides}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-zinc-500">Prazo médio pagamento</div>
          <div className="text-2xl font-semibold">{indicators.avgPaymentDays} dias</div>
        </div>
        <div className="rounded border p-3 md:col-span-2">
          <div className="text-xs text-zinc-500 mb-1">Glosa por operadora</div>
          <div className="flex flex-wrap gap-2">
            {indicators.glosaPercentByInsurer.map((i) => (
              <Badge key={i.insurer} variant="secondary">
                {i.insurer}: {i.glosaPercent}%
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label>Competência (AAAA-MM)</Label>
          <Input value={competence} onChange={(e) => setCompetence(e.target.value)} placeholder="2025-07" />
        </div>
        <div>
          <Label>Operadora</Label>
          <select
            className="rounded border px-2 py-2 text-sm"
            value={insurerId}
            onChange={(e) => setInsurerId(e.target.value)}
          >
            <option value="">Todas</option>
            {insurers.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
        <Button variant="outline" onClick={refresh} disabled={pending}>Atualizar</Button>
        <Link href="/app/faturamento/autorizacoes" className="text-sm text-blue-600 underline">
          Central de autorizações
        </Link>
        <Link href="/app/faturamento/conciliacao" className="text-sm text-blue-600 underline">
          Conciliação
        </Link>
        <Link href="/app/faturamento/glosas" className="text-sm text-blue-600 underline">
          Glosas
        </Link>
      </div>

      {message && <p className="text-sm text-green-700">{message}</p>}

      <div className="rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="p-2 w-8" />
              <th className="p-2 text-left">Guia</th>
              <th className="p-2 text-left">Paciente</th>
              <th className="p-2 text-left">Operadora</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-right">Valor</th>
              <th className="p-2 text-left">Pendências</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => {
              const errors = g.validationErrors as Array<{ field: string; message: string }>;
              return (
                <tr key={g.id} className="border-t">
                  <td className="p-2">
                    {g.status === "PRONTA" && (
                      <input
                        type="checkbox"
                        checked={selected.includes(g.id)}
                        onChange={() => toggle(g.id)}
                      />
                    )}
                  </td>
                  <td className="p-2">#{g.guideNumber}</td>
                  <td className="p-2">{g.appointment.patient.fullName}</td>
                  <td className="p-2">{g.healthInsurer.name}</td>
                  <td className="p-2"><Badge>{g.status}</Badge></td>
                  <td className="p-2 text-right">{formatBRL(g.totalValueCents)}</td>
                  <td className="p-2 text-red-600 text-xs">
                    {errors.map((e) => e.message).join("; ") || "—"}
                  </td>
                  <td className="p-2 space-x-1">
                    {g.status === "RASCUNHO" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          startTransition(async () => {
                            await revalidateGuideAction(g.id);
                            refresh();
                          })
                        }
                      >
                        Revalidar
                      </Button>
                    )}
                    <Link href={`/app/faturamento/guias/${g.id}/imprimir`} className="text-xs underline">
                      Imprimir
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <Button
          disabled={!insurerId || selected.length === 0 || pending}
          onClick={() =>
            startTransition(async () => {
              const comp = competence || new Date().toISOString().slice(0, 7);
              const r = await createBatchAction({
                healthInsurerId: insurerId,
                competence: comp,
                guideIds: selected,
              });
              if (!r.success) {
                setMessage("error" in r ? r.error : "Erro");
                return;
              }
              setSelected([]);
              setMessage("Lote criado");
              refresh();
            })
          }
        >
          Gerar lote ({selected.length})
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="font-medium">Lotes</h2>
        {batches.map((b) => (
          <div key={b.id} className="rounded border p-3 flex flex-wrap gap-3 items-center justify-between">
            <div>
              <div className="font-medium">
                Lote #{b.batchNumber} — {b.healthInsurer.name} — {b.competence}
              </div>
              <div className="text-sm text-zinc-500">{b.guides.length} guias · {b.status}</div>
            </div>
            <div className="flex gap-2">
              {b.status === "ABERTO" && (
                <Button
                  size="sm"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await closeBatchAction(b.id);
                      setMessage(r.success ? "Lote fechado — XML gerado" : ("error" in r ? r.error : "Erro"));
                      refresh();
                    })
                  }
                >
                  Fechar lote
                </Button>
              )}
              {b.status === "FECHADO" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      startTransition(async () => {
                        const { xml, hash } = await downloadBatchXmlAction(b.id);
                        const blob = new Blob([xml], { type: "application/xml" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `lote-${b.batchNumber}.xml`;
                        a.click();
                        setMessage(`XML baixado (hash ${hash})`);
                      })
                    }
                  >
                    Baixar XML
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      startTransition(async () => {
                        const r = await sendBatchAction(b.id);
                        setMessage(r.success ? "Lote enviado (mock)" : ("error" in r ? r.error : "Erro"));
                        refresh();
                      })
                    }
                  >
                    Enviar
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
