import { requireAuth } from "@/lib/auth/guards";
import { CommissionPanel } from "@/modules/finance/components/commission-panel";

export default async function RepassePage() {
  await requireAuth(["OWNER", "ADMIN", "FINANCEIRO", "PROFISSIONAL_SAUDE"]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Repasse profissional</h1>
      <CommissionPanel />
    </div>
  );
}
