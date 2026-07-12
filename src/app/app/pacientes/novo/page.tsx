import { requireAuth } from "@/lib/auth/guards";
import { PatientForm } from "@/modules/patients/components/patient-form";

export default async function NovoPacientePage() {
  await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE", "RECEPCAO"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novo paciente</h1>
        <p className="text-zinc-600">Cadastro completo de paciente</p>
      </div>
      <PatientForm mode="create" />
    </div>
  );
}
