import { requireAuth } from "@/lib/auth/guards";
import { InsurersPanel } from "@/modules/tiss/components/insurers-panel";
import {
  listInsurersAction,
  listServiceMappingsAction,
} from "@/modules/tiss/actions/tiss.actions";
import { adminPrisma } from "@/lib/db/admin-client";
import { auth } from "@/lib/auth/auth";

export default async function ConveniosPage() {
  await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  const session = await auth();
  const orgId = session!.organizationId!;

  const [insurers, services, priceTables] = await Promise.all([
    listInsurersAction(),
    listServiceMappingsAction(),
    adminPrisma.priceTable.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Convênios</h1>
      <InsurersPanel insurers={insurers} services={services} priceTables={priceTables} />
    </div>
  );
}
