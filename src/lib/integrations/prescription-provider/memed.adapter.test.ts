import { describe, expect, it } from "vitest";
import { MemedPrescriptionAdapter } from "./memed.adapter";

describe("MemedPrescriptionAdapter", () => {
  const adapter = new MemedPrescriptionAdapter();

  it("creates embed session with mock URL", async () => {
    const session = await adapter.createEmbedSession({
      organizationId: "org1",
      professionalId: "prof1",
      professionalName: "Dr. Ana",
      patientExternalId: "pat1",
      patientName: "João",
    });
    expect(session.embedUrl).toContain("memed");
    expect(session.sessionId).toBeTruthy();
  });

  it("parses webhook payload", () => {
    const result = adapter.parseWebhook?.({
      prescription_id: "rx-123",
      status: "completed",
      items: [{ drug: "Dipirona", dosage: "500mg 8/8h" }],
    });
    expect(result).toEqual({
      externalPrescriptionId: "rx-123",
      status: "COMPLETED",
      items: [{ drugName: "Dipirona", dosage: "500mg 8/8h" }],
    });
  });

  it("parses cancelled webhook", () => {
    const result = adapter.parseWebhook?.({
      event: "prescription.cancelled",
      id: "rx-456",
    });
    expect(result?.status).toBe("CANCELLED");
    expect(result?.externalPrescriptionId).toBe("rx-456");
  });

  it("returns null for invalid webhook", () => {
    expect(adapter.parseWebhook?.({ event: "ping" })).toBeNull();
  });
});
