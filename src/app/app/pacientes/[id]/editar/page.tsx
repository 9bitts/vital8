import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { PatientForm } from "@/modules/patients/components/patient-form";
import { getPatientAction } from "@/modules/patients/actions/patient.actions";

type Props = {
  params: { id: string };
};

export default async function EditarPacientePage({ params }: Props) {
  await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE", "RECEPCAO"]);
  const data = await getPatientAction(params.id);

  if (!data) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar paciente</h1>
        <p className="text-zinc-600">{data.patient.fullName}</p>
      </div>
      <PatientForm mode="edit" patientId={params.id} initialData={data} />
    </div>
  );
}
