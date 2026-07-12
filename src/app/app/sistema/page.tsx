import { requireAuth } from "@/lib/auth/guards";
import { adminPrisma } from "@/lib/db/admin-client";

export default async function SistemaPage() {
  await requireAuth(["OWNER", "ADMIN"]);

  const [failedComms, pendingExports, orgCount] = await Promise.all([
    adminPrisma.communicationLog.count({ where: { status: "FALHA" } }),
    adminPrisma.organizationExport.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
    adminPrisma.organization.count({ where: { isActive: true, deletedAt: null } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Saúde do sistema</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded border p-4">
          <p className="text-sm text-zinc-600">Mensagens com falha</p>
          <p className="text-2xl font-semibold">{failedComms}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-zinc-600">Exportações pendentes</p>
          <p className="text-2xl font-semibold">{pendingExports}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-zinc-600">Organizações ativas</p>
          <p className="text-2xl font-semibold">{orgCount}</p>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Versão {process.env.npm_package_version ?? "0.1.0"} · Jobs via /api/jobs/process · Health /api/health
      </p>
    </div>
  );
}
