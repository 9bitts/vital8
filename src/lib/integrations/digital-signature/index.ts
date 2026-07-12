import type { SignatureProvider } from "@/generated/prisma/client";
import { A1SignatureAdapter } from "./a1.adapter";
import { DevSimpleSignatureAdapter } from "./dev-simple.adapter";
import { DsasSignatureAdapter } from "./dsas.adapter";
import type { DigitalSignatureAdapter } from "./types";

let devAdapter: DigitalSignatureAdapter | null = null;
let a1Adapter: DigitalSignatureAdapter | null = null;
let dsasAdapter: DigitalSignatureAdapter | null = null;

export function isLacunaProvider(provider: SignatureProvider): boolean {
  return provider === "ICP_LACUNA";
}

export function getDigitalSignatureAdapter(
  provider: SignatureProvider = "DEV_SIMPLE",
): DigitalSignatureAdapter {
  if (provider === "ICP_LACUNA") {
    throw new Error("ICP_LACUNA usa fluxo assíncrono via startLacunaClinicalSign");
  }
  if (provider === "ICP_A1") {
    if (!a1Adapter) a1Adapter = new A1SignatureAdapter();
    return a1Adapter;
  }
  if (provider === "ICP_DSAS") {
    if (!dsasAdapter) dsasAdapter = new DsasSignatureAdapter();
    return dsasAdapter;
  }
  if (!devAdapter) devAdapter = new DevSimpleSignatureAdapter();
  return devAdapter;
}

export { getLacunaReadiness } from "./lacuna-readiness";
export { isLacunaConfigured } from "./lacuna-client";
export {
  startLacunaClinicalSign,
  completeLacunaClinicalSign,
  defaultReturnPath,
} from "./lacuna-signature.service";
export type { LacunaRedirectOutcome } from "./lacuna-signature.service";

export type {
  DigitalSignatureAdapter,
  SignatureInput,
  SignatureResult,
  SignatureMethod,
} from "./types";
