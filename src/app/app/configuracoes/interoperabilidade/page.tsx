import { requireAuth } from "@/lib/auth/guards";
import { hasOrgFeature } from "@/lib/features/subscription.service";
import { redirect } from "next/navigation";
import { getInteroperabilityDashboardAction } from "@/modules/interoperability/actions/interoperability.actions";
import { InteroperabilityPanel } from "@/modules/interoperability/components/interoperability-panel";

export default async function InteroperabilityPage() {
  const ctx = await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"]);
  const enabled = await hasOrgFeature(ctx.organizationId, "interoperability");
  if (!enabled) {
    redirect("/app/assinatura");
  }

  const dashboard = await getInteroperabilityDashboardAction();
  if (!dashboard.success || !dashboard.data) {
    return <p className="text-red-600">Erro ao carregar interoperabilidade</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Interoperabilidade</h1>
        <p className="text-zinc-600">
          FHIR R4, credenciamento RNDS e integração com laboratórios (ENTERPRISE)
        </p>
      </div>
      <InteroperabilityPanel
        credentials={dashboard.data.credentials}
        submissions={dashboard.data.submissions}
        settings={dashboard.data.settings}
        reconciliations={dashboard.data.reconciliations}
      />
      <p className="text-sm text-zinc-500">
        Guia de credenciamento real: <a href="/docs/rnds.md" className="underline">docs/rnds.md</a>
      </p>
    </div>
  );
}
