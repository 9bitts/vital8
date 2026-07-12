import { requireAuth } from "@/lib/auth/guards";
import { CashFlowPanel } from "@/modules/finance/components/cash-flow-panel";

export default async function FluxoPage() {
  await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Fluxo de caixa</h1>
      <CashFlowPanel />
    </div>
  );
}
