import { requireAuth } from "@/lib/auth/guards";
import { ConciliationPanel } from "@/modules/tiss/components/conciliation-panel";
import { listBatchesAction } from "@/modules/tiss/actions/tiss.actions";
import { adminPrisma } from "@/lib/db/admin-client";

export default async function ConciliacaoPage() {
  await requireAuth(["OWNER", "ADMIN", "FINANCEIRO"]);
  const batches = await listBatchesAction();
  const glosaCodes = await adminPrisma.glosaReasonCode.findMany({
    where: { isActive: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Conciliação</h1>
      <ConciliationPanel
        batches={batches.filter((b) => b.status === "ENVIADO" || b.status === "CONCILIADO" || b.status === "FECHADO")}
        glosaCodes={glosaCodes}
      />
    </div>
  );
}
