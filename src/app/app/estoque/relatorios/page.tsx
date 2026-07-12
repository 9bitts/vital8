import { requireAuth } from "@/lib/auth/guards";
import { ReportsPanel } from "@/modules/inventory/components/reports-panel";
import {
  getControlledBookAction,
  getReportsAction,
} from "@/modules/inventory/actions/inventory.actions";

export default async function RelatoriosEstoquePage() {
  await requireAuth(["OWNER", "ADMIN", "ESTOQUE", "FINANCEIRO"]);
  const to = new Date();
  const from = new Date(Date.now() - 90 * 86400000);
  const [reports, controlledBook] = await Promise.all([
    getReportsAction(90),
    getControlledBookAction(from, to).catch(() => []),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Relatórios de estoque</h1>
      <ReportsPanel reports={reports} controlledBook={controlledBook} />
    </div>
  );
}
