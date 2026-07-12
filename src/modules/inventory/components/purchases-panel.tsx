"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createPurchaseOrderAction,
  receivePurchaseAction,
  sendPurchaseOrderAction,
} from "@/modules/inventory/actions/inventory.actions";

type Order = Awaited<
  ReturnType<typeof import("@/modules/inventory/actions/inventory.actions").listPurchasesAction>
>[number];
type Supplier = { id: string; name: string };
type Product = { id: string; name: string };
type Location = { id: string; name: string };
type Suggestion = Awaited<
  ReturnType<typeof import("@/modules/inventory/actions/inventory.actions").suggestPurchasesAction>
>[number];

type Props = {
  orders: Order[];
  suppliers: Supplier[];
  products: Product[];
  locations: Location[];
  suggestions: Suggestion[];
};

export function PurchasesPanel({
  orders,
  suppliers,
  products,
  locations,
  suggestions,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [receiveOrderId, setReceiveOrderId] = useState("");

  return (
    <div className="space-y-6">
      {suggestions.length > 0 && (
        <div className="rounded border p-3">
          <h3 className="font-medium">Sugestão automática (abaixo do mínimo)</h3>
          <ul className="text-sm mt-2">
            {suggestions.map((s) => (
              <li key={s.product.id}>
                {s.product.name}: comprar {s.suggestedPurchaseQty} {s.product.purchaseUnit}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        className="rounded border p-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await createPurchaseOrderAction({
              supplierId: fd.get("supplierId"),
              createPayable: fd.get("createPayable") === "on",
              items: [
                {
                  productId: fd.get("productId") as string,
                  orderedQtyPurchase: Number(fd.get("qty")),
                  unitCostCents: Number(fd.get("cost")),
                },
              ],
            });
            setMessage(r.success ? "Pedido criado" : ("error" in r ? r.error : "Erro"));
          });
        }}
      >
        <h3 className="font-medium">Novo pedido</h3>
        <select name="supplierId" className="w-full rounded border px-2 py-2" required>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select name="productId" className="w-full rounded border px-2 py-2" required>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <Input name="qty" type="number" placeholder="Qtd compra" required min={1} />
          <Input name="cost" type="number" placeholder="Custo unit. centavos" required min={0} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="createPayable" defaultChecked /> Gerar conta a pagar
        </label>
        <Button type="submit" disabled={pending}>Criar pedido</Button>
      </form>

      {orders.map((o) => (
        <div key={o.id} className="rounded border p-3 space-y-2">
          <div className="flex justify-between">
            <span className="font-medium">{o.supplier.name}</span>
            <Badge>{o.status}</Badge>
          </div>
          <ul className="text-sm">
            {o.items.map((i) => (
              <li key={i.id}>
                {i.product.name}: {i.receivedQtyPurchase}/{i.orderedQtyPurchase} {i.product.purchaseUnit}
                {i.receivedQtyPurchase < i.orderedQtyPurchase && (
                  <span className="text-amber-600"> — pendente</span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            {o.status === "RASCUNHO" && (
              <Button
                size="sm"
                onClick={() =>
                  startTransition(async () => {
                    const r = await sendPurchaseOrderAction(o.id);
                    setMessage(r.success ? "Pedido enviado (e-mail mock)" : ("error" in r ? r.error : "Erro"));
                  })
                }
              >
                Enviar
              </Button>
            )}
            {(o.status === "ENVIADO" || o.status === "RECEBIDO_PARCIAL") && (
              <Button size="sm" variant="outline" onClick={() => setReceiveOrderId(o.id)}>
                Receber
              </Button>
            )}
          </div>

          {receiveOrderId === o.id && (
            <form
              className="border-t pt-2 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const item = o.items.find((i) => i.receivedQtyPurchase < i.orderedQtyPurchase);
                if (!item) return;
                startTransition(async () => {
                  const r = await receivePurchaseAction({
                    orderId: o.id,
                    toLocationId: fd.get("toLocationId") as string,
                    lines: [
                      {
                        orderItemId: item.id,
                        qtyPurchase: Number(fd.get("qtyPurchase")),
                        batchNumber: (fd.get("batchNumber") as string) || undefined,
                        expiryDate: fd.get("expiryDate") || undefined,
                      },
                    ],
                  });
                  setMessage(r.success ? "Recebimento registrado" : ("error" in r ? r.error : "Erro"));
                  setReceiveOrderId("");
                });
              }}
            >
              <select name="toLocationId" className="w-full rounded border px-2 py-2" required>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <Input name="qtyPurchase" type="number" placeholder="Qtd recebida" required min={1} />
              <Input name="batchNumber" placeholder="Lote" />
              <Input name="expiryDate" type="date" />
              <Button type="submit" size="sm" disabled={pending}>Confirmar recebimento</Button>
            </form>
          )}
        </div>
      ))}
      {message && <p className="text-sm text-green-700">{message}</p>}
    </div>
  );
}
