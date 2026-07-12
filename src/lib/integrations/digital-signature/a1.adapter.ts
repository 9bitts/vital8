import { createHash } from "crypto";
import type {
  DigitalSignatureAdapter,
  SignatureInput,
  SignatureResult,
} from "./types";
import { requestActTimestamp } from "./timestamp";

/** Assinatura ICP-Brasil A1 no servidor — PKCS#7/CAdES simulado com certificado PFX. */
export class A1SignatureAdapter implements DigitalSignatureAdapter {
  async sign(input: SignatureInput): Promise<SignatureResult> {
    if (!input.certificatePfxBase64 || !input.certificatePassword) {
      throw new Error("Certificado A1 obrigatório para assinatura ICP_A1");
    }

    const signedPayload = [
      input.contentHash,
      input.entityType,
      input.entityId,
      input.userId,
      input.timestamp.toISOString(),
    ].join("|");

    const cadesDetached = createHash("sha256")
      .update(signedPayload + input.certificatePfxBase64.slice(0, 64))
      .digest("base64");

    const timestampToken = await this.requestTimestamp?.(input.contentHash);

    return {
      signatureId: `a1-${input.entityId}-${input.timestamp.getTime()}`,
      signedAt: input.timestamp,
      method: "ICP_A1",
      metadata: {
        userId: input.userId,
        userName: input.userName,
        contentHash: input.contentHash,
        entityType: input.entityType,
        entityId: input.entityId,
        cadesDetached,
        certificatePresent: "true",
        algorithm: "SHA256withRSA",
      },
      timestampToken: timestampToken ?? undefined,
      padesBlock: `ICP-A1:${cadesDetached}`,
    };
  }

  async requestTimestamp(contentHash: string): Promise<string | null> {
    return requestActTimestamp(contentHash);
  }
}
