import { requireAuth } from "@/lib/auth/guards";
import { getAiSettingsAction } from "@/modules/ai/actions/ai.actions";
import { AiSettingsPanel } from "@/modules/ai/components/ai-settings-panel";
import { hasOrgFeature } from "@/lib/features/subscription.service";

export default async function IaConfigPage() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  const enabled = await hasOrgFeature(ctx.organizationId, "ai");
  if (!enabled) {
    return (
      <p className="text-zinc-600">
        Recursos de IA disponíveis no plano ENTERPRISE.
      </p>
    );
  }
  const data = await getAiSettingsAction();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inteligência Artificial</h1>
        <p className="text-zinc-600">
          IA sugere, humano decide — configure consentimentos, recursos e simulador da secretária virtual
        </p>
      </div>
      <AiSettingsPanel initial={data} />
    </div>
  );
}
