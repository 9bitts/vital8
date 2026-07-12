import { BR_TERMINOLOGY } from "../lib/identifiers";
import type { FhirServiceRequest } from "../types/fhir-types";
import type { Vital8ServiceRequest } from "../types/vital8-types";

export function serviceRequestToFhir(s: Vital8ServiceRequest): FhirServiceRequest {
  const primaryExam = s.items[0];
  return {
    resourceType: "ServiceRequest",
    id: s.id,
    status: "active",
    intent: "order",
    category: [
      {
        coding: [
          { system: BR_TERMINOLOGY.SERVICE_REQUEST_CATEGORY, code: "laboratory", display: "Laboratory" },
        ],
      },
    ],
    code: { text: primaryExam?.examName ?? "Exame laboratorial" },
    subject: { reference: `Patient/${s.patientId}` },
    authoredOn: s.createdAt,
    note: s.items.map((i) => ({
      text: i.instructions ? `${i.examName}: ${i.instructions}` : i.examName,
    })),
  };
}

export function serviceRequestFromFhir(
  fhir: FhirServiceRequest,
  organizationId: string,
  encounterId: string,
  authorUserId: string,
): Vital8ServiceRequest {
  const patientId = fhir.subject?.reference?.split("/")[1] ?? "";
  const items =
    fhir.note?.map((n) => {
      const text = n.text ?? "";
      const sep = text.indexOf(": ");
      if (sep > 0) {
        return { examName: text.slice(0, sep), instructions: text.slice(sep + 2) };
      }
      return { examName: text || fhir.code?.text || "Exame", instructions: null };
    }) ??
    [{ examName: fhir.code?.text ?? "Exame", instructions: null }];

  return {
    id: fhir.id ?? "",
    organizationId,
    patientId,
    encounterId,
    authorUserId,
    items,
    createdAt: fhir.authoredOn ?? new Date().toISOString(),
  };
}
