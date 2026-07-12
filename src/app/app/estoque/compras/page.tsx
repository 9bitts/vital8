import { requireAuth } from "@/lib/auth/guards";
import { adminPrisma } from "@/lib/db/admin-client";
import { auth } from "@/lib/auth/auth";
import { PurchasesPanel } from "@/modules/inventory/components/purchases-panel";
import {
  listLocationsAction,
  listProductsAction,
  listPurchasesAction,
  suggestPurchasesAction,
} from "@/modules/inventory/actions/inventory.actions";

export default async function ComprasPage() {
  await requireAuth(["OWNER", "ADMIN", "ESTOQUE", "FINANCEIRO"]);
  const session = await auth();
  const orgId = session!.organizationId!;

  const [orders, locations, products, suggestions, suppliers] = await Promise.all([
    listPurchasesAction(),
    listLocationsAction(),
    listProductsAction(),
    suggestPurchasesAction(),
    adminPrisma.supplier.findMany({
      where: { organizationId: orgId, deletedAt: null, isActive: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Compras</h1>
      <PurchasesPanel
        orders={orders}
        suppliers={suppliers}
        products={products}
        locations={locations}
        suggestions={suggestions}
      />
    </div>
  );
}
