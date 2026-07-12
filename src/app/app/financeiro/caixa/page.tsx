import { requireAuth } from "@/lib/auth/guards";
import { CashRegisterPanel } from "@/modules/finance/components/cash-register-panel";

export default async function CaixaPage() {
  await requireAuth(["OWNER", "ADMIN", "RECEPCAO", "FINANCEIRO"]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Caixa</h1>
      <CashRegisterPanel />
    </div>
  );
}
