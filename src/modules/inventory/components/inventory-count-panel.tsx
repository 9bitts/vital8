"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  closeInventoryAction,
  openInventoryAction,
  recordInventoryCountAction,
} from "@/modules/inventory/actions/inventory.actions";

type Inventory = Awaited<
  ReturnType<typeof import("@/modules/inventory/actions/inventory.actions").listInventoriesAction>
>[number];
type Location = { id: string; name: string };

type Props = {
  inventories: Inventory[];
  locations: Location[];
};

export function InventoryCountPanel({ inventories, locations }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const active = inventories.find((i) => i.status !== "FECHADO");

  return (
    <div className="space-y-4">
      {!active && (
        <div className="flex gap-2 items-end">
          <select id="inv-loc" className="rounded border px-2 py-2">
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <Button
            disabled={pending}
            onClick={() => {
              const sel = document.getElementById("inv-loc") as HTMLSelectElement;
              startTransition(async () => {
                const r = await openInventoryAction(sel.value);
                setMessage(r.success ? "Inventário aberto" : ("error" in r ? r.error : "Erro"));
                if (r.success) window.location.reload();
              });
            }}
          >
            Abrir inventário
          </Button>
        </div>
      )}

      {active && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">
              Inventário — {active.location.name} <Badge>{active.status}</Badge>
            </h3>
            <a
              href={`/app/estoque/inventario/${active.id}/imprimir`}
              className="text-sm underline"
              target="_blank"
              rel="noreferrer"
            >
              Folha de contagem (imprimir)
            </a>
          </div>
          <p className="text-sm text-zinc-500">Contagem às cegas — informe apenas o contado.</p>
          {active.counts.map((c) => (
            <form
              key={c.id}
              className="flex gap-2 items-center text-sm border-b py-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  await recordInventoryCountAction({
                    countId: c.id,
                    countedQty: Number(fd.get("countedQty")),
                  });
                  setMessage("Contagem salva");
                });
              }}
            >
              <span className="flex-1">
                {c.product.name}
                {c.batch ? ` — lote ${c.batch.batchNumber}` : ""}
              </span>
              <Input
                name="countedQty"
                type="number"
                className="w-24"
                placeholder="Contado"
                defaultValue={c.countedQty ?? undefined}
                min={0}
              />
              <Button type="submit" size="sm" variant="outline" disabled={pending}>
                Salvar
              </Button>
            </form>
          ))}
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await closeInventoryAction(active.id);
                setMessage(
                  r.success
                    ? "Inventário fechado — ajustes gerados"
                    : ("error" in r ? r.error : "Erro"),
                );
                if (r.success) window.location.reload();
              })
            }
          >
            Fechar inventário
          </Button>
        </div>
      )}

      <div>
        <h3 className="font-medium">Histórico</h3>
        <ul className="text-sm mt-2">
          {inventories.filter((i) => i.status === "FECHADO").map((i) => (
            <li key={i.id}>
              {i.location.name} — {i.closedAt?.toISOString().slice(0, 10)} — {i.counts.length} itens
            </li>
          ))}
        </ul>
      </div>
      {message && <p className="text-sm text-green-700">{message}</p>}
    </div>
  );
}
