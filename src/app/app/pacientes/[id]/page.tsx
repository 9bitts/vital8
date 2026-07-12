import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { PatientProfile } from "@/modules/patients/components/patient-profile";
import {
  getPatientAction,
  getPatientTimelineAction,
} from "@/modules/patients/actions/patient.actions";
import { getPatientAppointmentsAction } from "@/modules/scheduling/actions/appointment.actions";
import {
  getPatientEmrHistoryAction,
  getPatientAccessLogsAction,
} from "@/modules/emr/actions/emr.actions";
import { getPatientFinanceHistoryAction } from "@/modules/finance/actions/finance.actions";

type Props = {
  params: { id: string };
};

export default async function PacienteDetailPage({ params }: Props) {
  const ctx = await requireAuth();
  const [data, timeline, appointments, emrHistory, accessLogs, financeHistory] =
    await Promise.all([
      getPatientAction(params.id),
      getPatientTimelineAction(params.id),
      getPatientAppointmentsAction(params.id),
      getPatientEmrHistoryAction(params.id).catch(() => ({
        encounters: [],
        prescriptions: [],
      })),
      getPatientAccessLogsAction(params.id).catch(() => []),
      getPatientFinanceHistoryAction(params.id).catch(() => ({
        sales: [],
        payments: [],
      })),
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
    <PatientProfile
      data={data}
      timeline={timeline}
      appointments={appointments}
      emrHistory={emrHistory}
      accessLogs={accessLogs}
      financeHistory={financeHistory}
      role={ctx.role}
    />
  );
}
