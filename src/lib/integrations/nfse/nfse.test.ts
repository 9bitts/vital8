import { describe, expect, it } from "vitest";
import { buildDpsPayload, generateAccessKey } from "./dps-builder";
import { MockNfseAdapter } from "./mock.adapter";

describe("NFS-e DPS builder", () => {
  it("builds DPS payload with tomador and serviço", () => {
    const dps = buildDpsPayload(
      {
        organizationId: "org1",
        organizationDocument: "11222333000181",
        organizationName: "Clínica",
        patientName: "Maria",
        patientDocument: "52998224725",
        patientDocumentType: "CPF",
        serviceDescription: "Consulta",
        amountCents: 15000,
        nacionalServiceCode: "040101",
        issRateBasisPoints: 500,
      },
      "000000000000001",
    );
    expect(dps.versao).toBe("1.00");
    expect((dps.dps as Record<string, unknown>).nDPS).toBe("000000000000001");
  });

  it("includes CBS/IBS when enabled", () => {
    const dps = buildDpsPayload(
      {
        organizationId: "org1",
        organizationDocument: "11222333000181",
        organizationName: "Clínica",
        patientName: "Maria",
        serviceDescription: "Consulta",
        amountCents: 10000,
        cbsIbsEnabled: true,
        cbsRateBasisPoints: 90,
        ibsRateBasisPoints: 120,
      },
      "1",
    );
    const reforma = (dps.dps as Record<string, unknown>).reformaTributaria;
    expect(reforma).toBeTruthy();
  });

  it("generates access key", () => {
    const key = generateAccessKey("123", "11222333000181");
    expect(key.startsWith("NFS")).toBe(true);
  });
});

describe("MockNfseAdapter", () => {
  it("issues NFS-e with number, chave and DPS", async () => {
    const adapter = new MockNfseAdapter();
    const result = await adapter.issue({
      organizationId: "org1",
      organizationDocument: "11222333000181",
      organizationName: "Clínica Teste",
      patientName: "João",
      serviceDescription: "Consulta médica",
      amountCents: 20000,
    });
    expect(result.number).toBeTruthy();
    expect(result.accessKey).toBeTruthy();
    expect(result.dpsNumber).toBeTruthy();
    expect(result.pdfBase64).toBeTruthy();

    const consult = await adapter.consult(result.accessKey);
    expect(consult.status).toBe("ISSUED");
  });
});
