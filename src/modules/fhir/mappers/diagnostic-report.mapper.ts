import { BR_TERMINOLOGY } from "../lib/identifiers";
import type { FhirDiagnosticReport } from "../types/fhir-types";
import type { Vital8DiagnosticReport } from "../types/vital8-types";
import { observationToFhir } from "./observation.mapper";

export function diagnosticReportToFhir(r: Vital8DiagnosticReport): FhirDiagnosticReport {
  return {
    resourceType: "DiagnosticReport",
    id: r.id,
    meta: { lastUpdated: r.updatedAt },
    status: "final",
    category: [
      {
        coding: [
          { system: BR_TERMINOLOGY.OBSERVATION_CATEGORY, code: "LAB", display: "Laboratory" },
        ],
      },
    ],
    code: { text: r.fileName ?? "Resultado de exame" },
    subject: { reference: `Patient/${r.patientId}` },
    effectiveDateTime: r.resultedAt,
    issued: r.resultedAt,
    basedOn: r.requestId ? [{ reference: `ServiceRequest/${r.requestId}` }] : undefined,
    result: r.observations.map((o) => ({ reference: `Observation/${o.id}` })),
  };
}

export function diagnosticReportWithObservations(r: Vital8DiagnosticReport) {
  return {
    report: diagnosticReportToFhir(r),
    observations: r.observations.map((o) => observationToFhir(o)),
  };
}

export function diagnosticReportFromFhir(
  fhir: FhirDiagnosticReport,
  organizationId: string,
): Omit<Vital8DiagnosticReport, "observations"> {
  const patientId = fhir.subject?.reference?.split("/")[1] ?? "";
  const requestId = fhir.basedOn?.[0]?.reference?.split("/")[1] ?? null;

  return {
    id: fhir.id ?? "",
    organizationId,
    patientId,
    requestId,
    encounterId: null,
    fileName: fhir.code?.text ?? null,
    mimeType: null,
    resultedAt: fhir.effectiveDateTime ?? fhir.issued ?? new Date().toISOString(),
    updatedAt: fhir.meta?.lastUpdated ?? new Date().toISOString(),
  };
}
