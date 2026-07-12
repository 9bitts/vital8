import { requireAuth } from "@/lib/auth/guards";
import { DuplicateMergePanel } from "@/modules/patients/components/duplicate-merge-panel";
import { listDuplicatesAction } from "@/modules/patients/actions/patient.actions";

export default async function DuplicadosPage() {
  await requireAuth(["OWNER", "ADMIN"]);
  const groups = await listDuplicatesAction();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pacientes duplicados</h1>
        <p className="text-zinc-600">
          Detecção por CPF ou nome + data de nascimento
        </p>
      </div>
      <DuplicateMergePanel groups={groups} />
    </div>
  );
}
