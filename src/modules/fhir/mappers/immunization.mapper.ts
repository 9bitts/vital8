import type { FhirImmunization } from "../types/fhir-types";
import type { Vital8Immunization } from "../types/vital8-types";

/** Estrutura pronta — sem UI nesta fase. */
export function immunizationToFhir(i: Vital8Immunization): FhirImmunization {
  return {
    resourceType: "Immunization",
    id: i.id,
    status: "completed",
    vaccineCode: {
      coding: [{ code: i.vaccineCode, display: i.vaccineDisplay }],
      text: i.vaccineDisplay,
    },
    patient: { reference: `Patient/${i.patientId}` },
    occurrenceDateTime: i.occurrenceDate,
    primarySource: true,
  };
}

export function immunizationFromFhir(fhir: FhirImmunization, patientId: string): Vital8Immunization {
  const coding = fhir.vaccineCode?.coding?.[0];
  return {
    id: fhir.id ?? "",
    patientId,
    vaccineCode: coding?.code ?? "",
    vaccineDisplay: coding?.display ?? fhir.vaccineCode?.text ?? "",
    occurrenceDate: fhir.occurrenceDateTime ?? new Date().toISOString(),
  };
}
