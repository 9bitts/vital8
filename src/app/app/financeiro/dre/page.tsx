import { requireAuth } from "@/lib/auth/guards";
import { DrePanel } from "@/modules/finance/components/dre-panel";

export default async function DrePage() {
  await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">DRE simplificada</h1>
      <DrePanel />
    </div>
  );
}
