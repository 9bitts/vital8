import { requireAuth } from "@/lib/auth/guards";
import { BillingDashboard } from "@/modules/tiss/components/billing-dashboard";
import {
  getIndicatorsAction,
  listBatchesAction,
  listGuidesAction,
  listInsurersAction,
} from "@/modules/tiss/actions/tiss.actions";

export default async function FaturamentoPage() {
  await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  const [insurers, guides, batches, indicators] = await Promise.all([
    listInsurersAction(),
    listGuidesAction(),
    listBatchesAction(),
    getIndicatorsAction(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Faturamento TISS</h1>
      <BillingDashboard
        insurers={insurers.map((i) => ({ id: i.id, name: i.name }))}
        initialGuides={guides}
        initialBatches={batches}
        indicators={indicators}
      />
    </div>
  );
}
