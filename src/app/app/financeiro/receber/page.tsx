import { requireAuth } from "@/lib/auth/guards";
import { ReceivablesPanel } from "@/modules/finance/components/receivables-panel";

export default async function ReceberPage() {
  await requireAuth(["OWNER", "ADMIN", "RECEPCAO", "FINANCEIRO"]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Contas a receber</h1>
      <ReceivablesPanel />
    </div>
  );
}
