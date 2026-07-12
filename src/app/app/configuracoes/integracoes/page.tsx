import { requireAuth } from "@/lib/auth/guards";
import { getLacunaReadiness } from "@/lib/integrations/digital-signature";
import { getStripeReadiness } from "@/lib/integrations/billing/stripe-readiness";
import { getWhatsAppReadiness } from "@/lib/integrations/messaging";
import { getDailyReadiness } from "@/lib/integrations/video";
import { getLlmReadiness } from "@/lib/integrations/llm";
import { getTissReadiness } from "@/lib/tiss/tiss-readiness";
import { getInfraReadiness } from "@/lib/integrations/infra-readiness";
import { listGoogleCalendarLinksAction } from "@/modules/integrations/actions/calendar.actions";
import { listApiClientsAction } from "@/modules/api/actions/api.actions";
import { ApiIntegrationsPanel } from "@/modules/api/components/api-integrations-panel";
import { IntegrationsStatusPanel } from "@/modules/integrations/components/integrations-status-panel";

export default async function ApiIntegrationsPage() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  const [clients, whatsapp, stripe, lacuna, daily, llm, tiss, infra, calendarLinks] =
    await Promise.all([
    listApiClientsAction(),
    getWhatsAppReadiness(ctx.organizationId),
    Promise.resolve(getStripeReadiness()),
    Promise.resolve(getLacunaReadiness()),
    Promise.resolve(getDailyReadiness()),
    Promise.resolve(getLlmReadiness()),
    getTissReadiness(ctx.organizationId),
    Promise.resolve(getInfraReadiness()),
    listGoogleCalendarLinksAction(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API e Integrações</h1>
        <p className="text-zinc-600">
          Providers externos, API pública v1 e status de conectividade
        </p>
      </div>

      <IntegrationsStatusPanel
        whatsapp={whatsapp}
        stripe={stripe}
        lacuna={lacuna}
        daily={daily}
        llm={llm}
        tiss={tiss}
        infra={infra}
        calendarLinks={calendarLinks}
      />

      <div>
        <h2 className="text-lg font-medium mb-2">API pública</h2>
        <ApiIntegrationsPanel clients={clients} />
      </div>

      <p className="text-sm text-zinc-500">
        Documentação:{" "}
        <a href="/app/desenvolvedores" className="underline">
          Portal de desenvolvedores
        </a>
        {" · "}
        Spec OpenAPI:{" "}
        <a href="/api/v1/openapi.json" className="underline">
          /api/v1/openapi.json
        </a>
        {" · "}
        Integrações: ver `docs/integracoes.md` no repositório
      </p>
    </div>
  );
}
