/** Incorpora bloco PAdES simplificado (metadados de assinatura) ao PDF. */
export function embedPadesSignatureBlock(
  pdf: Buffer,
  meta: {
    verificationCode: string;
    contentHash: string;
    signerName: string;
    signedAt: Date;
    method: string;
    timestampToken?: string | null;
    padesBlock?: string | null;
  },
): Buffer {
  const text = pdf.toString("utf8");
  const block = [
    "",
    "% Vital8 PAdES Signature Block",
    `% VerificationCode: ${meta.verificationCode}`,
    `% ContentHash-SHA256: ${meta.contentHash}`,
    `% Signer: ${meta.signerName}`,
    `% SignedAt: ${meta.signedAt.toISOString()}`,
    `% Method: ${meta.method}`,
    meta.padesBlock ? `% Signature: ${meta.padesBlock}` : "",
    meta.timestampToken ? `% TimestampToken: ${meta.timestampToken}` : "",
    "% EndSignature",
  ]
    .filter(Boolean)
    .join("\n");

  if (!text.includes("%%EOF")) {
    return Buffer.concat([pdf, Buffer.from(`\n${block}\n`, "utf8")]);
  }
  return Buffer.from(text.replace("%%EOF", `${block}\n%%EOF`), "utf8");
}
