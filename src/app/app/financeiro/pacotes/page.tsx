import { requireAuth } from "@/lib/auth/guards";
import { PackagesPanel } from "@/modules/finance/components/packages-panel";

export default async function PacotesPage() {
  await requireAuth(["OWNER", "ADMIN", "RECEPCAO", "FINANCEIRO"]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Pacotes</h1>
      <PackagesPanel />
    </div>
  );
}
