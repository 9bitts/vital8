import { requireAuth } from "@/lib/auth/guards";
import { CONFIG_ROLES } from "@/modules/scheduling/lib/permissions";
import { SchedulingConfigPanel } from "@/modules/scheduling/components/scheduling-config-panel";

export default async function AgendaConfigPage() {
  await requireAuth([...CONFIG_ROLES]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Configurações da agenda</h1>
        <p className="text-sm text-zinc-500">
          Profissionais, serviços, salas, grade e feriados
        </p>
      </div>
      <SchedulingConfigPanel />
    </div>
  );
}
