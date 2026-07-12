import { BR_PROFILES, BR_TERMINOLOGY } from "../lib/identifiers";
import type { FhirCondition } from "../types/fhir-types";
import type { Vital8Condition } from "../types/vital8-types";

export function conditionToFhir(c: Vital8Condition): FhirCondition {
  return {
    resourceType: "Condition",
    id: c.id,
    meta: { profile: [BR_PROFILES.CONDITION], lastUpdated: c.updatedAt },
    clinicalStatus: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }],
    },
    verificationStatus: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed" }],
    },
    category: [{ coding: [{ system: BR_TERMINOLOGY.CID10, code: "problem-list-item" }] }],
    code: {
      coding: [{ system: BR_TERMINOLOGY.CID10, code: c.cidCode, display: c.description ?? undefined }],
      text: c.description ?? c.cidCode,
    },
    subject: { reference: `Patient/${c.patientId}` },
    onsetDateTime: c.updatedAt,
  };
}

export function conditionFromFhir(fhir: FhirCondition, patientId: string): Vital8Condition {
  const coding = fhir.code?.coding?.find((c) => c.system === BR_TERMINOLOGY.CID10);
  return {
    id: fhir.id ?? "",
    patientId,
    cidCode: coding?.code ?? fhir.code?.text ?? "",
    description: coding?.display ?? fhir.code?.text ?? null,
    updatedAt: fhir.meta?.lastUpdated ?? new Date().toISOString(),
  };
}
