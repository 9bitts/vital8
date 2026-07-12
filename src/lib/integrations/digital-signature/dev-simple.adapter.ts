import type {
  DigitalSignatureAdapter,
  SignatureInput,
  SignatureResult,
} from "./types";

/** Assinatura de desenvolvimento: usuário + hash + timestamp (sem certificado ICP). */
export class DevSimpleSignatureAdapter implements DigitalSignatureAdapter {
  async sign(input: SignatureInput): Promise<SignatureResult> {
    return {
      signatureId: `dev-${input.userId}-${input.timestamp.getTime()}`,
      signedAt: input.timestamp,
      method: "DEV_SIMPLE",
      metadata: {
        userId: input.userId,
        userName: input.userName,
        contentHash: input.contentHash,
        note: "Assinatura simples de desenvolvimento — substituir por ICP-Brasil em produção",
      },
    };
  }
}
