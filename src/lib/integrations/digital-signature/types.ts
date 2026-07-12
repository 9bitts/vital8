export type SignatureInput = {
  userId: string;
  userName: string;
  contentHash: string;
  timestamp: Date;
};

export type SignatureResult = {
  signatureId: string;
  signedAt: Date;
  method: "DEV_SIMPLE" | "ICP_BRASIL";
  metadata: Record<string, string>;
};

export interface DigitalSignatureAdapter {
  sign(input: SignatureInput): Promise<SignatureResult>;
}
