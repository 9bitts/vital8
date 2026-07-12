import { createHash } from "crypto";
import type {
  DigitalSignatureAdapter,
  SignatureInput,
  SignatureResult,
} from "./types";
import { requestActTimestamp } from "./timestamp";

/** DSaS via API genérica (BirdID, Certisign, etc.). */
export class DsasSignatureAdapter implements DigitalSignatureAdapter {
  async sign(input: SignatureInput): Promise<SignatureResult> {
    const apiUrl = input.dsasApiUrl ?? process.env.DSAS_API_URL;
    let apiResponse: Record<string, string> | null = null;

    if (apiUrl && input.dsasApiKey) {
      try {
        const res = await fetch(`${apiUrl}/sign`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${input.dsasApiKey}`,
          },
          body: JSON.stringify({
            contentHash: input.contentHash,
            entityType: input.entityType,
            entityId: input.entityId,
            signerUserId: input.userId,
          }),
        });
        if (res.ok) {
          apiResponse = (await res.json()) as Record<string, string>;
        }
      } catch {
        // fallback simulado
      }
    }

    const signatureId =
      apiResponse?.signatureId ??
      `dsas-${createHash("sha256").update(input.contentHash).digest("hex").slice(0, 16)}`;

    const timestampToken = await this.requestTimestamp?.(input.contentHash);

    return {
      signatureId,
      signedAt: input.timestamp,
      method: "ICP_DSAS",
      metadata: {
        userId: input.userId,
        userName: input.userName,
        contentHash: input.contentHash,
        entityType: input.entityType,
        entityId: input.entityId,
        dsasProvider: apiResponse?.provider ?? "mock-dsas",
        apiStatus: apiResponse ? "connected" : "simulated",
      },
      timestampToken: timestampToken ?? undefined,
      padesBlock: `ICP-DSaS:${signatureId}`,
    };
  }

  async requestTimestamp(contentHash: string): Promise<string | null> {
    return requestActTimestamp(contentHash);
  }
}
