import type { NfseAdapter, NfseIssueInput, NfseIssueResult } from "./types";

let seq = 1000;

export class MockNfseAdapter implements NfseAdapter {
  async issue(input: NfseIssueInput): Promise<NfseIssueResult> {
    seq += 1;
    const number = String(seq).padStart(8, "0");
    const text = [
      "NFS-e (mock)",
      `Número: ${number}`,
      `Tomador: ${input.patientName}`,
      `Serviço: ${input.serviceDescription}`,
      `Valor: R$ ${(input.amountCents / 100).toFixed(2)}`,
    ].join("\n");

    return {
      number,
      pdfBase64: Buffer.from(text).toString("base64"),
      issuedAt: new Date(),
    };
  }
}
