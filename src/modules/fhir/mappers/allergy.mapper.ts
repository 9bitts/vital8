import type { FhirAllergyIntolerance } from "../types/fhir-types";
import type { Vital8Allergy } from "../types/vital8-types";

export function allergyToFhir(a: Vital8Allergy): FhirAllergyIntolerance {
  return {
    resourceType: "AllergyIntolerance",
    id: a.id,
    meta: { lastUpdated: a.updatedAt },
    clinicalStatus: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }],
    },
    verificationStatus: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", code: "confirmed" }],
    },
    type: "allergy",
    category: ["medication"],
    code: { text: a.substance },
    patient: { reference: `Patient/${a.patientId}` },
  };
}

export function allergyFromFhir(fhir: FhirAllergyIntolerance, patientId: string): Vital8Allergy {
  return {
    id: fhir.id ?? "",
    patientId,
    substance: fhir.code?.text ?? fhir.code?.coding?.[0]?.display ?? "",
    severity: null,
    updatedAt: fhir.meta?.lastUpdated ?? new Date().toISOString(),
  };
}
