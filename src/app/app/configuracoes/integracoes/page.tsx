import { requireAuth } from "@/lib/auth/guards";
import { listApiClientsAction } from "@/modules/api/actions/api.actions";
import { ApiIntegrationsPanel } from "@/modules/api/components/api-integrations-panel";

export default async function ApiIntegrationsPage() {
  await requireAuth(["OWNER", "ADMIN"]);
  const clients = await listApiClientsAction();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API e Integrações</h1>
        <p className="text-zinc-600">
          Gerencie clients, keys, escopos e monitore uso da API pública v1
        </p>
      </div>
      <ApiIntegrationsPanel clients={clients} />
      <p className="text-sm text-zinc-500">
        Documentação: <a href="/app/desenvolvedores" className="underline">Portal de desenvolvedores</a>
        {" · "}
        Spec OpenAPI: <a href="/api/v1/openapi.json" className="underline">/api/v1/openapi.json</a>
      </p>
    </div>
  );
}
