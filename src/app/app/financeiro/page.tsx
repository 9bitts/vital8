import { requireAuth } from "@/lib/auth/guards";
import { FinanceDashboard } from "@/modules/finance/components/finance-dashboard";

export default async function FinanceiroPage() {
  await requireAuth(["OWNER", "ADMIN", "RECEPCAO", "FINANCEIRO"]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Financeiro</h1>
      <FinanceDashboard />
    </div>
  );
}
