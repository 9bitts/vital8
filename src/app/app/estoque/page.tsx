import { requireAuth } from "@/lib/auth/guards";
import { InventoryDashboard } from "@/modules/inventory/components/inventory-dashboard";
import { getDashboardAction } from "@/modules/inventory/actions/inventory.actions";

export default async function EstoquePage() {
  await requireAuth(["OWNER", "ADMIN", "ESTOQUE", "FINANCEIRO", "RECEPCAO"]);
  const summary = await getDashboardAction();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Estoque</h1>
      <InventoryDashboard summary={summary} />
    </div>
  );
}
