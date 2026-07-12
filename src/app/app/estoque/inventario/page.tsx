import { requireAuth } from "@/lib/auth/guards";
import { InventoryCountPanel } from "@/modules/inventory/components/inventory-count-panel";
import {
  listInventoriesAction,
  listLocationsAction,
} from "@/modules/inventory/actions/inventory.actions";

export default async function InventarioPage() {
  await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
  const [inventories, locations] = await Promise.all([
    listInventoriesAction(),
    listLocationsAction(),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Inventário</h1>
      <InventoryCountPanel inventories={inventories} locations={locations} />
    </div>
  );
}
