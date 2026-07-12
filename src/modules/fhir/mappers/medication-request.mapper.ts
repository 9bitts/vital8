import type { FhirMedicationRequest } from "../types/fhir-types";
import type { Vital8MedicationRequest } from "../types/vital8-types";

export function medicationRequestToFhir(m: Vital8MedicationRequest): FhirMedicationRequest {
  return {
    resourceType: "MedicationRequest",
    id: m.id,
    meta: { lastUpdated: m.updatedAt },
    status: "active",
    intent: "order",
    medicationCodeableConcept: { text: m.drugName },
    subject: { reference: `Patient/${m.patientId}` },
    authoredOn: m.signedAt ?? m.updatedAt,
    dosageInstruction: [
      {
        text: [m.dosage, m.frequency, m.route].filter(Boolean).join(" — ") || undefined,
        route: m.route ? { text: m.route } : undefined,
      },
    ],
    dispenseRequest: m.quantity ? { quantity: { value: m.quantity } } : undefined,
  };
}

export function medicationRequestFromFhir(
  fhir: FhirMedicationRequest,
  patientId: string,
  encounterId: string,
): Vital8MedicationRequest {
  const dosageText = fhir.dosageInstruction?.[0]?.text ?? "";
  return {
    id: fhir.id ?? "",
    patientId,
    encounterId,
    drugName: fhir.medicationCodeableConcept?.text ?? "",
    dosage: dosageText || null,
    route: fhir.dosageInstruction?.[0]?.route?.text ?? null,
    frequency: null,
    quantity: fhir.dispenseRequest?.quantity?.value ?? null,
    signedAt: fhir.authoredOn ?? null,
    updatedAt: fhir.meta?.lastUpdated ?? new Date().toISOString(),
  };
}
