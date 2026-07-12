import { requireAuth } from "@/lib/auth/guards";
import { adminPrisma } from "@/lib/db/admin-client";

type Props = { params: { id: string } };

export default async function InventoryPrintPage({ params }: Props) {
  await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
  const inv = await adminPrisma.inventory.findFirstOrThrow({
    where: { id: params.id },
    include: {
      location: true,
      counts: { include: { product: true, batch: true } },
    },
  });

  return (
    <div className="max-w-2xl mx-auto p-8 print:p-4">
      <h1 className="text-lg font-bold mb-4">
        Folha de contagem — {inv.location.name}
      </h1>
      <p className="text-sm mb-4">Inventário {inv.id.slice(-8)} — contagem às cegas</p>
      <table className="w-full text-sm border-collapse border border-black">
        <thead>
          <tr>
            <th className="border border-black p-2 text-left">Produto</th>
            <th className="border border-black p-2 text-left">Lote</th>
            <th className="border border-black p-2 w-24">Contado</th>
          </tr>
        </thead>
        <tbody>
          {inv.counts.map((c) => (
            <tr key={c.id}>
              <td className="border border-black p-2">{c.product.name}</td>
              <td className="border border-black p-2">{c.batch?.batchNumber ?? "—"}</td>
              <td className="border border-black p-2 h-8" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
