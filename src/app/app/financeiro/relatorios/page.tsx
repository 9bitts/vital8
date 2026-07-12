import { requireAuth } from "@/lib/auth/guards";
import { ReportsPanel } from "@/modules/finance/components/reports-panel";

export default async function RelatoriosPage() {
  await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Relatórios</h1>
      <ReportsPanel />
    </div>
  );
}
