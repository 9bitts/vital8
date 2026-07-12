import { requireAuth } from "@/lib/auth/guards";
import { getReferralProgramAction } from "@/modules/marketing/actions/marketing.actions";

export default async function IndicacoesPage() {
  await requireAuth(["OWNER", "ADMIN"]);
  const program = await getReferralProgramAction();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Programa de indicação</h1>
      <div className="rounded border p-4 text-sm space-y-2">
        <p>
          <strong>Status:</strong> {program.isActive ? "Ativo" : "Inativo"}
        </p>
        <p>
          <strong>Recompensa:</strong> {program.rewardValue} ({program.rewardType})
        </p>
        <p>
          <strong>Limite mensal por paciente:</strong> {program.maxPerPatientMonth}
        </p>
        {program.terms && <p className="text-zinc-600">{program.terms}</p>}
      </div>
    </div>
  );
}
