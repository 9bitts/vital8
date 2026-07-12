import { BR_PROFILES, BR_TERMINOLOGY } from "../lib/identifiers";
import type { FhirEncounter } from "../types/fhir-types";
import type { Vital8Encounter } from "../types/vital8-types";

const STATUS_MAP: Record<string, string> = {
  RASCUNHO: "in-progress",
  ASSINADO: "finished",
};

const STATUS_REVERSE: Record<string, string> = {
  "in-progress": "RASCUNHO",
  finished: "ASSINADO",
};

export function encounterToFhir(e: Vital8Encounter): FhirEncounter {
  return {
    resourceType: "Encounter",
    id: e.id,
    meta: { profile: [BR_PROFILES.ENCOUNTER], lastUpdated: e.updatedAt },
    status: STATUS_MAP[e.status] ?? "in-progress",
    class: {
      coding: [
        {
          system: BR_TERMINOLOGY.ENCOUNTER_CLASS,
          code: e.modality === "TELECONSULTA" ? "VR" : "AMB",
          display: e.modality,
        },
      ],
    },
    subject: { reference: `Patient/${e.patientId}` },
    participant: [{ individual: { reference: `Practitioner/${e.professionalId}` } }],
    period: { start: e.startedAt, end: e.endedAt ?? undefined },
    appointment: e.appointmentId ? [{ reference: `Appointment/${e.appointmentId}` }] : undefined,
    serviceProvider: { reference: `Organization/${e.organizationId}` },
  };
}

export function encounterFromFhir(fhir: FhirEncounter, organizationId: string): Vital8Encounter {
  const patientId = fhir.subject?.reference?.split("/")[1] ?? "";
  const professionalId = fhir.participant?.[0]?.individual?.reference?.split("/")[1] ?? "";
  const appointmentId = fhir.appointment?.[0]?.reference?.split("/")[1] ?? null;
  const modality = fhir.class?.coding?.[0]?.code === "VR" ? "TELECONSULTA" : "PRESENCIAL";

  return {
    id: fhir.id ?? "",
    organizationId,
    patientId,
    professionalId,
    appointmentId,
    status: STATUS_REVERSE[fhir.status ?? "in-progress"] ?? "RASCUNHO",
    modality,
    specialty: null,
    startedAt: fhir.period?.start ?? new Date().toISOString(),
    endedAt: fhir.period?.end ?? null,
    signedAt: fhir.status === "finished" ? fhir.period?.end ?? null : null,
    contentHash: null,
    updatedAt: fhir.meta?.lastUpdated ?? new Date().toISOString(),
  };
}
