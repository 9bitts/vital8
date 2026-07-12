import { requireAuth } from "@/lib/auth/guards";
import { PayablesPanel } from "@/modules/finance/components/payables-panel";

export default async function PagarPage() {
  await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Contas a pagar</h1>
      <PayablesPanel />
    </div>
  );
}
