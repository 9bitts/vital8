import { requireAuth } from "@/lib/auth/guards";
import { ProductsPanel } from "@/modules/inventory/components/products-panel";
import { listProductsAction } from "@/modules/inventory/actions/inventory.actions";

export default async function ProdutosPage() {
  await requireAuth(["OWNER", "ADMIN", "ESTOQUE", "FINANCEIRO", "RECEPCAO"]);
  const products = await listProductsAction();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Produtos</h1>
      <ProductsPanel products={products} />
    </div>
  );
}
