import { buildDpsPayload, generateAccessKey } from "./dps-builder";
import type {
  NfseAdapter,
  NfseConsultResult,
  NfseIssueInput,
  NfseIssueResult,
} from "./types";

let seq = 1000;

export class MockNfseAdapter implements NfseAdapter {
  private issued = new Map<string, NfseIssueResult>();

  async issue(input: NfseIssueInput): Promise<NfseIssueResult> {
    seq += 1;
    const dpsNumber = String(seq).padStart(15, "0");
    const number = String(seq).padStart(8, "0");
    const accessKey = generateAccessKey(dpsNumber, input.organizationDocument);
    const dps = buildDpsPayload(input, dpsNumber);

    const text = [
      "NFS-e Padrão Nacional (mock)",
      `Número: ${number}`,
      `Chave: ${accessKey}`,
      `DPS: ${dpsNumber}`,
      `Prestador: ${input.organizationName}`,
      `Tomador: ${input.patientName}`,
      `Serviço: ${input.serviceDescription}`,
      `Valor: R$ ${(input.amountCents / 100).toFixed(2)}`,
    ].join("\n");

    const result: NfseIssueResult = {
      number,
      accessKey,
      dpsNumber,
      pdfBase64: Buffer.from(text).toString("base64"),
      xmlOrJson: { dps, status: "AUTORIZADA" },
      issuedAt: new Date(),
    };

    this.issued.set(accessKey, result);
    return result;
  }

  async consult(accessKey: string): Promise<NfseConsultResult> {
    const doc = this.issued.get(accessKey);
    if (!doc) {
      return { accessKey, status: "UNKNOWN" };
    }
    return {
      accessKey,
      status: "ISSUED",
      number: doc.number,
      issuedAt: doc.issuedAt,
    };
  }

  async cancel(accessKey: string, reason: string): Promise<{ cancelledAt: Date }> {
    void reason;
    this.issued.delete(accessKey);
    return { cancelledAt: new Date() };
  }

  async substitute(
    accessKey: string,
    input: NfseIssueInput,
  ): Promise<NfseIssueResult> {
    await this.cancel(accessKey, "Substituição");
    return this.issue(input);
  }
}
