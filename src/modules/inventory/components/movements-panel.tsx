"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  lookupBarcodeAction,
  registerMovementAction,
} from "@/modules/inventory/actions/inventory.actions";

type Location = { id: string; name: string };

type Props = {
  locations: Location[];
  products: Array<{ id: string; name: string }>;
};

export function MovementsPanel({ locations, products }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const barcodeRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div className="rounded border p-3 space-y-2">
        <Label>Leitura código de barras (pistola USB)</Label>
        <Input
          ref={barcodeRef}
          placeholder="Escaneie ou digite o código..."
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const code = barcodeRef.current?.value.trim();
              if (!code) return;
              startTransition(async () => {
                const p = await lookupBarcodeAction(code);
                if (p) setMessage(`Encontrado: ${p.name}`);
                else setMessage("Produto não encontrado");
              });
            }
          }}
        />
      </div>

      <form
        className="grid gap-2 md:grid-cols-2 rounded border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await registerMovementAction({
              movementType: fd.get("movementType"),
              productId: fd.get("productId"),
              fromLocationId: fd.get("fromLocationId") || undefined,
              toLocationId: fd.get("toLocationId") || undefined,
              quantity: Number(fd.get("quantity")),
              batchNumber: fd.get("batchNumber") || undefined,
              expiryDate: fd.get("expiryDate") || undefined,
              unitCostCents: Number(fd.get("unitCostCents") || 0),
              reason: fd.get("reason") || undefined,
            });
            setMessage(r.success ? "Movimento registrado" : ("error" in r ? r.error : "Erro"));
          });
        }}
      >
        <div>
          <Label>Tipo</Label>
          <select name="movementType" className="w-full rounded border px-2 py-2" required>
            <option value="ENTRADA_AJUSTE">Entrada avulsa</option>
            <option value="SAIDA_CONSUMO">Saída consumo</option>
            <option value="SAIDA_PERDA">Saída perda</option>
            <option value="TRANSFERENCIA">Transferência</option>
          </select>
        </div>
        <div>
          <Label>Produto</Label>
          <select name="productId" className="w-full rounded border px-2 py-2" required>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Origem</Label>
          <select name="fromLocationId" className="w-full rounded border px-2 py-2">
            <option value="">—</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Destino</Label>
          <select name="toLocationId" className="w-full rounded border px-2 py-2">
            <option value="">—</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div><Label>Quantidade (un. consumo)</Label><Input name="quantity" type="number" required min={1} /></div>
        <div><Label>Lote</Label><Input name="batchNumber" /></div>
        <div><Label>Validade</Label><Input name="expiryDate" type="date" /></div>
        <div><Label>Custo unit. (centavos)</Label><Input name="unitCostCents" type="number" defaultValue={0} /></div>
        <div className="md:col-span-2"><Label>Motivo</Label><Input name="reason" /></div>
        <Button type="submit" disabled={pending}>Registrar</Button>
      </form>
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
