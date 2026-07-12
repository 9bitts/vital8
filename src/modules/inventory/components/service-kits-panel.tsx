"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveKitAction } from "@/modules/inventory/actions/inventory.actions";

type Service = Awaited<
  ReturnType<typeof import("@/modules/inventory/actions/inventory.actions").listServicesForKitAction>
>[number];
type Product = { id: string; name: string };

type Props = { services: Service[]; products: Product[] };

export function ServiceKitsPanel({ services, products }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-4">
      {services.map((s) => (
        <form
          key={s.id}
          className="rounded border p-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await saveKitAction({
                serviceId: s.id,
                items: [
                  {
                    productId: fd.get("productId") as string,
                    quantity: Number(fd.get("quantity")),
                  },
                ],
              });
              setMessage(r.success ? `Kit ${s.name} salvo` : ("error" in r ? r.error : "Erro"));
            });
          }}
        >
          <h3 className="font-medium">{s.name}</h3>
          {s.consumptionKit && (
            <ul className="text-sm text-zinc-600">
              {s.consumptionKit.items.map((i) => (
                <li key={i.id}>{i.quantity}× {i.product.name}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <select name="productId" className="rounded border px-2 py-2 flex-1" required>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Input name="quantity" type="number" defaultValue={1} min={1} className="w-24" />
            <Button type="submit" size="sm" disabled={pending}>Salvar kit</Button>
          </div>
        </form>
      ))}
      {message && <p className="text-sm text-green-700">{message}</p>}
    </div>
  );
}
