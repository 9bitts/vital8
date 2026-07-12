import type { FhirAppointment } from "../types/fhir-types";
import type { Vital8Appointment } from "../types/vital8-types";

const STATUS_MAP: Record<string, string> = {
  AGENDADO: "booked",
  CONFIRMADO: "booked",
  EM_ESPERA: "arrived",
  EM_ATENDIMENTO: "checked-in",
  FINALIZADO: "fulfilled",
  CANCELADO: "cancelled",
  FALTOU: "noshow",
};

const STATUS_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_MAP).map(([k, v]) => [v, k]),
);

export function appointmentToFhir(a: Vital8Appointment): FhirAppointment {
  return {
    resourceType: "Appointment",
    id: a.id,
    meta: { lastUpdated: a.updatedAt },
    status: STATUS_MAP[a.status] ?? "booked",
    start: a.startsAt,
    end: a.endsAt,
    participant: [
      { actor: { reference: `Patient/${a.patientId}` }, status: "accepted" },
      { actor: { reference: `Practitioner/${a.professionalId}` }, status: "accepted" },
      ...(a.branchId
        ? [{ actor: { reference: `Location/${a.branchId}` }, status: "accepted" }]
        : []),
    ],
    serviceType: [{ text: a.serviceId }],
  };
}

export function appointmentFromFhir(fhir: FhirAppointment, organizationId: string): Vital8Appointment {
  const patientRef = fhir.participant?.find((p) => p.actor?.reference?.startsWith("Patient/"));
  const profRef = fhir.participant?.find((p) => p.actor?.reference?.startsWith("Practitioner/"));
  const branchRef = fhir.participant?.find((p) => p.actor?.reference?.startsWith("Location/"));

  return {
    id: fhir.id ?? "",
    organizationId,
    patientId: patientRef?.actor?.reference?.split("/")[1] ?? "",
    professionalId: profRef?.actor?.reference?.split("/")[1] ?? "",
    serviceId: fhir.serviceType?.[0]?.text ?? "",
    branchId: branchRef?.actor?.reference?.split("/")[1] ?? null,
    status: STATUS_REVERSE[fhir.status ?? "booked"] ?? "AGENDADO",
    startsAt: fhir.start ?? new Date().toISOString(),
    endsAt: fhir.end ?? new Date().toISOString(),
    updatedAt: fhir.meta?.lastUpdated ?? new Date().toISOString(),
  };
}
