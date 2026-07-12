import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { PatientProfile } from "@/modules/patients/components/patient-profile";
import {
  getPatientAction,
  getPatientTimelineAction,
} from "@/modules/patients/actions/patient.actions";

type Props = {
  params: { id: string };
};

export default async function PacienteDetailPage({ params }: Props) {
  const ctx = await requireAuth();
  const [data, timeline] = await Promise.all([
    getPatientAction(params.id),
    getPatientTimelineAction(params.id),
  ]);

  if (!data) {
    return (
      <div>
        <p>Paciente não encontrado</p>
        <Link href="/app/pacientes">Voltar</Link>
      </div>
    );
  }

  return (
    <PatientProfile data={data} timeline={timeline} role={ctx.role} />
  );
}
