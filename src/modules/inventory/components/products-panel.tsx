"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProductAction } from "@/modules/inventory/actions/inventory.actions";

type Product = Awaited<
  ReturnType<typeof import("@/modules/inventory/actions/inventory.actions").listProductsAction>
>[number];

type Props = { products: Product[] };

export function ProductsPanel({ products }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-6">
      <form
        className="grid gap-2 md:grid-cols-2 rounded border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await saveProductAction({
              name: fd.get("name"),
              productType: fd.get("productType"),
              barcode: fd.get("barcode") || undefined,
              purchaseUnit: fd.get("purchaseUnit") || "UN",
              consumeUnit: fd.get("consumeUnit") || "UN",
              conversionFactor: Number(fd.get("conversionFactor") || 1),
              minStock: Number(fd.get("minStock") || 0),
              requiresBatchExpiry: fd.get("requiresBatchExpiry") === "on",
              isControlled: fd.get("isControlled") === "on",
              controlledList: fd.get("controlledList") || undefined,
            });
            setMessage(r.success ? "Produto salvo" : ("error" in r ? r.error : "Erro"));
          });
        }}
      >
        <div><Label>Nome</Label><Input name="name" required /></div>
        <div>
          <Label>Tipo</Label>
          <select name="productType" className="w-full rounded border px-2 py-2" required>
            <option value="INSUMO">Insumo</option>
            <option value="MATERIAL">Material</option>
            <option value="MEDICAMENTO">Medicamento</option>
            <option value="REVENDA">Revenda</option>
          </select>
        </div>
        <div><Label>Código de barras</Label><Input name="barcode" /></div>
        <div><Label>Unidade compra / consumo / fator</Label>
          <div className="flex gap-1">
            <Input name="purchaseUnit" placeholder="CX" defaultValue="UN" />
            <Input name="consumeUnit" placeholder="UN" defaultValue="UN" />
            <Input name="conversionFactor" type="number" defaultValue={1} />
          </div>
        </div>
        <div><Label>Estoque mínimo</Label><Input name="minStock" type="number" defaultValue={0} /></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requiresBatchExpiry" /> Exige lote/validade
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isControlled" /> Controlado (344)
        </label>
        <div>
          <Label>Lista</Label>
          <select name="controlledList" className="w-full rounded border px-2 py-2">
            <option value="">—</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>Salvar produto</Button>
      </form>

      <div className="rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="p-2 text-left">Produto</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">Barcode</th>
              <th className="p-2 text-right">Custo médio</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.name}{p.isControlled && " ⚕"}</td>
                <td className="p-2">{p.productType}</td>
                <td className="p-2">{p.barcode ?? "—"}</td>
                <td className="p-2 text-right">R$ {(p.averageCostCents / 100).toFixed(2)}</td>
                <td className="p-2">
                  <Link href={`/app/estoque/produtos/${p.id}`} className="underline text-xs">
                    Kardex
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message && <p className="text-sm text-green-700">{message}</p>}
    </div>
  );
}
