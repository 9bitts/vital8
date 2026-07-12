import { requireAuth } from "@/lib/auth/guards";
import { EncounterWorkspace } from "@/modules/emr/components/encounter-workspace";
import { EncounterTimer } from "@/modules/emr/components/encounter-timer";

type Props = {
  params: { id: string };
};

export default async function AtendimentoPage({ params }: Props) {
  await requireAuth([
    "OWNER",
    "ADMIN",
    "PROFISSIONAL_SAUDE",
    "RECEPCAO",
    "LEITURA",
  ]);

  return (
    <div className="space-y-4">
      <EncounterTimer encounterId={params.id} />
      <EncounterWorkspace encounterId={params.id} />
    </div>
  );
}
