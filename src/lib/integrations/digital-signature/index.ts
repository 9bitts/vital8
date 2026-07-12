import { DevSimpleSignatureAdapter } from "./dev-simple.adapter";
import type { DigitalSignatureAdapter } from "./types";

let adapter: DigitalSignatureAdapter | null = null;

export function getDigitalSignatureAdapter(): DigitalSignatureAdapter {
  if (!adapter) {
    adapter = new DevSimpleSignatureAdapter();
  }
  return adapter;
}

export type { DigitalSignatureAdapter, SignatureInput, SignatureResult } from "./types";
