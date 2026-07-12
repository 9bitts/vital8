import type { FhirDiagnosticReport, FhirObservation } from "@/modules/fhir/types/fhir-types";
import type { LabIntegrationAdapter, LabOrderInput, LabResultPayload } from "./types";

const pendingOrders = new Map<string, LabOrderInput>();

export class MockLabIntegrationAdapter implements LabIntegrationAdapter {
  async sendOrder(input: LabOrderInput): Promise<{ externalOrderId: string }> {
    const externalOrderId = `LAB-MOCK-${input.requestId.slice(-8).toUpperCase()}`;
    pendingOrders.set(input.requestId, input);
    return { externalOrderId };
  }

  async simulateResult(requestId: string): Promise<LabResultPayload> {
    const order = pendingOrders.get(requestId);
    if (!order) {
      throw new Error(`Pedido ${requestId} não encontrado no simulador`);
    }

    const examName = order.exams[0]?.name ?? "Hemograma";
    const obsId = `obs-${requestId.slice(-6)}`;

    const observations: FhirObservation[] = [
      {
        resourceType: "Observation",
        id: obsId,
        status: "final",
        code: { text: "Hemoglobina" },
        subject: { reference: `Patient/${order.patientId}` },
        effectiveDateTime: new Date().toISOString(),
        valueQuantity: { value: 13.8, unit: "g/dL" },
        referenceRange: [{ text: "12-16", low: { value: 12 }, high: { value: 16 } }],
      },
      {
        resourceType: "Observation",
        id: `${obsId}-2`,
        status: "final",
        code: { text: "Glicemia" },
        subject: { reference: `Patient/${order.patientId}` },
        effectiveDateTime: new Date().toISOString(),
        valueQuantity: { value: 118, unit: "mg/dL" },
        referenceRange: [{ text: "70-99", low: { value: 70 }, high: { value: 99 } }],
      },
    ];

    const diagnosticReport: FhirDiagnosticReport = {
      resourceType: "DiagnosticReport",
      id: `dr-${requestId.slice(-6)}`,
      status: "final",
      code: { text: examName },
      subject: { reference: `Patient/${order.patientId}` },
      effectiveDateTime: new Date().toISOString(),
      issued: new Date().toISOString(),
      basedOn: [{ reference: `ServiceRequest/${requestId}` }],
      result: observations.map((o) => ({ reference: `Observation/${o.id}` })),
    };

    return {
      externalRequestId: requestId,
      diagnosticReport,
      observations,
    };
  }

  async pollResults(organizationId: string): Promise<LabResultPayload[]> {
    void organizationId;
    return [];
  }
}

export function clearMockLabOrdersForTests() {
  pendingOrders.clear();
}
