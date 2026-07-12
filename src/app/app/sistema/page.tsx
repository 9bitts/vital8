import { requireAuth } from "@/lib/auth/guards";
import { adminPrisma } from "@/lib/db/admin-client";

export default async function SistemaPage() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  const organizationId = ctx.organizationId;

  const [failedComms, pendingExports, syncLogs] = await Promise.all([
    adminPrisma.communicationLog.count({
      where: { organizationId, status: "FALHA" },
    }),
    adminPrisma.organizationExport.count({
      where: { organizationId, status: { in: ["PENDING", "PROCESSING"] } },
    }),
    adminPrisma.mobileSyncLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { name: true, email: true } } },
    }),
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
          <p className="text-sm text-zinc-600">Sincronizações mobile (últimas 20)</p>
          <p className="text-2xl font-semibold">{syncLogs.length}</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Sincronizações mobile (PWA)</h2>
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-zinc-50 text-left dark:bg-zinc-900">
                <th className="p-2">Quando</th>
                <th className="p-2">Usuário</th>
                <th className="p-2">Duração</th>
                <th className="p-2">Aplicadas</th>
                <th className="p-2">Rejeitadas</th>
                <th className="p-2">Pendentes</th>
              </tr>
            </thead>
            <tbody>
              {syncLogs.map((log: (typeof syncLogs)[number]) => (
                <tr key={log.id} className="border-b">
                  <td className="p-2">{new Date(log.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="p-2">{log.user.name ?? log.user.email}</td>
                  <td className="p-2">{log.durationMs}ms</td>
                  <td className="p-2">{log.actionsApplied}</td>
                  <td className="p-2">{log.actionsRejected}</td>
                  <td className="p-2">{log.actionsPending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-zinc-500">
        Versão {process.env.npm_package_version ?? "0.1.0"} · Jobs via /api/jobs/process · Health /api/health
      </p>
    </div>
  );
}
