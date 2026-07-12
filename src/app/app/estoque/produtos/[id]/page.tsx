import { requireAuth } from "@/lib/auth/guards";
import { formatBRL } from "@/lib/money";
import { getProductDetailAction } from "@/modules/inventory/actions/inventory.actions";

type Props = { params: { id: string } };

export default async function ProductDetailPage({ params }: Props) {
  await requireAuth(["OWNER", "ADMIN", "ESTOQUE", "FINANCEIRO", "RECEPCAO"]);
  const { product, balances, totalQty, kardex } = await getProductDetailAction(params.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{product.name}</h1>
      <p className="text-sm text-zinc-600">
        Saldo total: {totalQty} {product.consumeUnit} · Custo médio:{" "}
        {formatBRL(product.averageCostCents)}/{product.consumeUnit}
      </p>

      <section>
        <h2 className="font-medium mb-2">Saldo por localização / lote</h2>
        <ul className="text-sm space-y-1">
          {balances.map((b) => (
            <li key={b.id}>
              {b.location.name}
              {b.batch ? ` — lote ${b.batch.batchNumber}` : ""}: {b.quantity}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-medium mb-2">Kardex</h2>
        <table className="w-full text-sm border">
          <thead className="bg-zinc-50">
            <tr>
              <th className="p-2 text-left">Data</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-right">Qtd</th>
              <th className="p-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {kardex.map((k) => (
              <tr key={k.id} className="border-t">
                <td className="p-2">{k.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="p-2">{k.movementType}</td>
                <td className="p-2 text-right">{k.quantity}</td>
                <td className="p-2 text-right">{k.runningBalance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
