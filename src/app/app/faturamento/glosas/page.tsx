import { requireAuth } from "@/lib/auth/guards";
import { GlosasPanel } from "@/modules/tiss/components/glosas-panel";
import { listGlosasAction } from "@/modules/tiss/actions/tiss.actions";

export default async function GlosasPage() {
  await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  const items = await listGlosasAction();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Gestão de glosas</h1>
      <GlosasPanel items={items} />
    </div>
  );
}
