import { requireAuth } from "@/lib/auth/guards";
import { MovementsPanel } from "@/modules/inventory/components/movements-panel";
import {
  listLocationsAction,
  listProductsAction,
} from "@/modules/inventory/actions/inventory.actions";

export default async function MovimentacoesPage() {
  await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
  const [locations, products] = await Promise.all([
    listLocationsAction(),
    listProductsAction(),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Movimentações</h1>
      <MovementsPanel locations={locations} products={products} />
    </div>
  );
}
