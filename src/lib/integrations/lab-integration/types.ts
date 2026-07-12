import type { FhirDiagnosticReport, FhirObservation } from "@/modules/fhir/types/fhir-types";

export type LabOrderInput = {
  requestId: string;
  patientId: string;
  patientName: string;
  exams: Array<{ name: string; instructions?: string | null }>;
};

export type LabResultPayload = {
  externalRequestId: string;
  diagnosticReport: FhirDiagnosticReport;
  observations: FhirObservation[];
};

export interface LabIntegrationAdapter {
  sendOrder(input: LabOrderInput): Promise<{ externalOrderId: string }>;
  pollResults?(organizationId: string): Promise<LabResultPayload[]>;
  simulateResult?(requestId: string): Promise<LabResultPayload>;
}
