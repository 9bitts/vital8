import { requireAuth } from "@/lib/auth/guards";
import { ServiceKitsPanel } from "@/modules/inventory/components/service-kits-panel";
import {
  listProductsAction,
  listServicesForKitAction,
} from "@/modules/inventory/actions/inventory.actions";

export default async function ServicosKitPage() {
  await requireAuth(["OWNER", "ADMIN", "ESTOQUE"]);
  const [services, products] = await Promise.all([
    listServicesForKitAction(),
    listProductsAction(),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Kits por serviço</h1>
      <p className="text-sm text-zinc-600">
        Produtos consumidos automaticamente ao finalizar atendimento (baixa FEFO).
      </p>
      <ServiceKitsPanel services={services} products={products} />
    </div>
  );
}
