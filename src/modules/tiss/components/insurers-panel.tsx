"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  importTussCsvAction,
  mapServiceTussAction,
  saveInsurerAction,
  saveInsurerContractAction,
  searchTussAction,
} from "@/modules/tiss/actions/tiss.actions";

type Insurer = Awaited<
  ReturnType<typeof import("@/modules/tiss/actions/tiss.actions").listInsurersAction>
>[number];
type ServiceRow = Awaited<
  ReturnType<typeof import("@/modules/tiss/actions/tiss.actions").listServiceMappingsAction>
>[number];
type PriceTable = { id: string; name: string };

type Props = {
  insurers: Insurer[];
  services: ServiceRow[];
  priceTables: PriceTable[];
};

export function InsurersPanel({ insurers, services, priceTables }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [tussQuery, setTussQuery] = useState("");
  const [tussResults, setTussResults] = useState<
    Array<{ id: string; code: string; term: string }>
  >([]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-medium">Operadoras</h2>
        {insurers.map((ins) => (
          <div key={ins.id} className="rounded border p-3 text-sm">
            <div className="font-medium">{ins.name}</div>
            <div>ANS: {ins.ansRegistration} · TISS {ins.tissVersion}</div>
            <div>Prazo: {ins.paymentTermDays}d · Fechamento dia {ins.batchClosingDay}</div>
            {ins.contracts[0] && (
              <div className="text-zinc-500">
                Tabela: {ins.contracts[0].priceTable.name}
              </div>
            )}
          </div>
        ))}
        <form
          className="grid gap-2 md:grid-cols-2 rounded border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await saveInsurerAction({
                name: fd.get("name"),
                ansRegistration: fd.get("ansRegistration"),
                cnpj: fd.get("cnpj"),
                tissVersion: fd.get("tissVersion") || "3.05.00",
                paymentTermDays: Number(fd.get("paymentTermDays") || 30),
                batchClosingDay: Number(fd.get("batchClosingDay") || 25),
                requiresAuthorization: fd.get("requiresAuthorization") === "on",
              });
              setMessage(r.success ? "Operadora salva" : ("error" in r ? r.error : "Erro"));
            });
          }}
        >
          <div><Label>Nome</Label><Input name="name" required /></div>
          <div><Label>Registro ANS</Label><Input name="ansRegistration" required /></div>
          <div><Label>CNPJ</Label><Input name="cnpj" required /></div>
          <div><Label>Versão TISS</Label><Input name="tissVersion" defaultValue="3.05.00" /></div>
          <div><Label>Prazo pagamento (dias)</Label><Input name="paymentTermDays" type="number" defaultValue={30} /></div>
          <div><Label>Dia fechamento lote</Label><Input name="batchClosingDay" type="number" defaultValue={25} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requiresAuthorization" /> Exige autorização
          </label>
          <Button type="submit" disabled={pending}>Salvar operadora</Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Vínculo operadora ↔ tabela de preços</h2>
        <form
          className="flex flex-wrap gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await saveInsurerContractAction({
                healthInsurerId: fd.get("healthInsurerId"),
                priceTableId: fd.get("priceTableId"),
              });
              setMessage(r.success ? "Contrato vinculado" : ("error" in r ? r.error : "Erro"));
            });
          }}
        >
          <select name="healthInsurerId" className="rounded border px-2 py-2" required>
            {insurers.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <select name="priceTableId" className="rounded border px-2 py-2" required>
            {priceTables.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <Button type="submit" disabled={pending}>Vincular</Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Mapeamento Service ↔ TUSS</h2>
        {services.map((s) => (
          <div key={s.id} className="text-sm flex justify-between border-b py-1">
            <span>{s.name}</span>
            <span className="text-zinc-500">
              {s.tussProcedure ? `${s.tussProcedure.code} — ${s.tussProcedure.term}` : "Sem TUSS"}
            </span>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            placeholder="Buscar TUSS..."
            value={tussQuery}
            onChange={(e) => setTussQuery(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              startTransition(async () => {
                setTussResults(await searchTussAction(tussQuery));
              })
            }
          >
            Buscar
          </Button>
        </div>
        <form
          className="flex gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await mapServiceTussAction({
                serviceId: fd.get("serviceId"),
                tussProcedureId: fd.get("tussProcedureId"),
              });
              setMessage(r.success ? "Mapeamento salvo" : ("error" in r ? r.error : "Erro"));
            });
          }}
        >
          <select name="serviceId" className="rounded border px-2 py-2" required>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select name="tussProcedureId" className="rounded border px-2 py-2 flex-1" required>
            {tussResults.map((t) => (
              <option key={t.id} value={t.id}>{t.code} — {t.term}</option>
            ))}
          </select>
          <Button type="submit" disabled={pending}>Mapear</Button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Importar TUSS (CSV)</h2>
        <p className="text-xs text-zinc-500">Formato: codigo;termo (cabeçalho opcional)</p>
        <textarea
          className="w-full rounded border p-2 text-sm font-mono"
          rows={4}
          id="tuss-csv"
          placeholder="code;term&#10;10101012;Consulta em consultório"
        />
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            const el = document.getElementById("tuss-csv") as HTMLTextAreaElement;
            startTransition(async () => {
              const r = await importTussCsvAction(el.value);
              setMessage(
                r.success
                  ? `${r.data!.imported} procedimentos importados`
                  : ("error" in r ? r.error : "Erro"),
              );
            });
          }}
        >
          Importar CSV
        </Button>
      </section>

      {message && <p className="text-sm text-green-700">{message}</p>}
    </div>
  );
}
