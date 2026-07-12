"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import {
  getConciliationAction,
  registerPaymentAction,
} from "@/modules/tiss/actions/tiss.actions";

type Batch = {
  id: string;
  batchNumber: number;
  competence: string;
  healthInsurer: { name: string };
  guides: Array<{ id: string; guideNumber: number; totalValueCents: number }>;
};

type Props = {
  batches: Batch[];
  glosaCodes: Array<{ code: string; description: string }>;
};

export function ConciliationPanel({ batches, glosaCodes }: Props) {
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [view, setView] = useState<Awaited<ReturnType<typeof getConciliationAction>> | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function loadView() {
    if (!batchId) return;
    startTransition(async () => {
      setView(await getConciliationAction(batchId));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <select
          className="rounded border px-2 py-2"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
        >
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              Lote #{b.batchNumber} — {b.healthInsurer.name} — {b.competence}
            </option>
          ))}
        </select>
        <Button variant="outline" onClick={loadView} disabled={pending}>
          Carregar
        </Button>
      </div>

      {view && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded border p-3 space-y-2">
            <h3 className="font-medium">Demonstrativo (lançamento)</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const guidePayments = view.rows.map((row) => ({
                  guideId: row.guide.id,
                  paidCents: Number(fd.get(`paid-${row.guide.id}`) || 0),
                  glosedCents: Number(fd.get(`glosed-${row.guide.id}`) || 0),
                  glosaReasonCode: (fd.get(`glosa-${row.guide.id}`) as string) || undefined,
                }));
                const gross = guidePayments.reduce((s, g) => s + g.paidCents + g.glosedCents, 0);
                const glosed = guidePayments.reduce((s, g) => s + g.glosedCents, 0);
                startTransition(async () => {
                  const r = await registerPaymentAction({
                    healthInsurerId: view.batch.healthInsurerId,
                    tissBatchId: view.batch.id,
                    paymentDate: fd.get("paymentDate"),
                    grossAmountCents: gross,
                    discountCents: 0,
                    netAmountCents: gross - glosed,
                    guidePayments,
                  });
                  setMessage(r.success ? "Demonstrativo conciliado" : ("error" in r ? r.error : "Erro"));
                  loadView();
                });
              }}
              className="space-y-3"
            >
              <input name="paymentDate" type="date" className="rounded border px-2 py-1" required />
              {view.rows.map((row) => (
                <div
                  key={row.guide.id}
                  className={`text-sm p-2 rounded border ${row.divergent ? "border-red-300 bg-red-50" : ""}`}
                >
                  <div className="font-medium">Guia #{row.guide.guideNumber}</div>
                  <div>Esperado: {formatBRL(row.expectedCents)}</div>
                  <div className="flex gap-2 mt-1">
                    <input
                      name={`paid-${row.guide.id}`}
                      type="number"
                      placeholder="Pago"
                      defaultValue={row.expectedCents}
                      className="w-24 rounded border px-1"
                    />
                    <input
                      name={`glosed-${row.guide.id}`}
                      type="number"
                      placeholder="Glosa"
                      defaultValue={0}
                      className="w-24 rounded border px-1"
                    />
                    <select name={`glosa-${row.guide.id}`} className="rounded border px-1 flex-1">
                      <option value="">Motivo glosa</option>
                      {glosaCodes.map((c) => (
                        <option key={c.code} value={c.code}>{c.code} — {c.description}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              <Button type="submit" disabled={pending}>Conciliar</Button>
            </form>
          </div>

          <div className="rounded border p-3">
            <h3 className="font-medium">Guias do lote</h3>
            <ul className="text-sm space-y-2 mt-2">
              {view.rows.map((row) => (
                <li key={row.guide.id} className="flex justify-between">
                  <span>#{row.guide.guideNumber}</span>
                  <span>{formatBRL(row.expectedCents)}</span>
                  <Badge>{row.guide.status}</Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {message && <p className="text-sm text-green-700">{message}</p>}
    </div>
  );
}
