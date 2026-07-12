export type SignatureMethod = "DEV_SIMPLE" | "ICP_A1" | "ICP_DSAS" | "ICP_LACUNA";

export type SignatureInput = {
  userId: string;
  userName: string;
  contentHash: string;
  entityType: string;
  entityId: string;
  timestamp: Date;
  certificatePfxBase64?: string;
  certificatePassword?: string;
  dsasApiUrl?: string;
  dsasApiKey?: string;
};

export type SignatureResult = {
  signatureId: string;
  signedAt: Date;
  method: SignatureMethod;
  metadata: Record<string, string>;
  timestampToken?: string;
  padesBlock?: string;
};

export interface DigitalSignatureAdapter {
  sign(input: SignatureInput): Promise<SignatureResult>;
  requestTimestamp?(contentHash: string): Promise<string | null>;
}
