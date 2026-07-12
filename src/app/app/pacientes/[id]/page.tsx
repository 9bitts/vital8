import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { PatientProfile } from "@/modules/patients/components/patient-profile";
import { getPatientAction } from "@/modules/patients/actions/patient.actions";

type Props = {
  params: { id: string };
};

export default async function PacienteDetailPage({ params }: Props) {
  const ctx = await requireAuth();
  const data = await getPatientAction(params.id);

  if (!data) notFound();

  const canAdmin = ctx.role === "OWNER" || ctx.role === "ADMIN";

  return <PatientProfile data={data} canAdmin={canAdmin} />;
}
