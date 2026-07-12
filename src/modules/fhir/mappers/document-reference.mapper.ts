import type { FhirDocumentReference } from "../types/fhir-types";
import type { Vital8DocumentReference } from "../types/vital8-types";

export function documentReferenceToFhir(d: Vital8DocumentReference): FhirDocumentReference {
  return {
    resourceType: "DocumentReference",
    id: d.id,
    status: "current",
    type: { text: d.category },
    subject: { reference: `Patient/${d.patientId}` },
    date: d.createdAt,
    content: [
      {
        attachment: {
          contentType: d.mimeType,
          title: d.fileName,
          url: `storage://${d.storageKey}`,
        },
      },
    ],
  };
}

export function documentReferenceFromFhir(fhir: FhirDocumentReference, patientId: string): Vital8DocumentReference {
  const attachment = fhir.content?.[0]?.attachment;
  const url = attachment?.url ?? "";
  const storageKey = url.startsWith("storage://") ? url.slice("storage://".length) : url;

  return {
    id: fhir.id ?? "",
    patientId,
    fileName: attachment?.title ?? "documento",
    mimeType: attachment?.contentType ?? "application/octet-stream",
    storageKey,
    category: fhir.type?.text ?? "OUTRO",
    createdAt: fhir.date ?? new Date().toISOString(),
  };
}
