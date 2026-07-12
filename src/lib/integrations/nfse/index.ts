import type { NfseProvider } from "@/generated/prisma/client";
import { MockNfseAdapter } from "./mock.adapter";
import { NacionalNfseAdapter } from "./nacional.adapter";
import type { NfseAdapter } from "./types";

let mockAdapter: NfseAdapter | null = null;
let nacionalAdapter: NfseAdapter | null = null;

export function getNfseAdapter(provider: NfseProvider = "MOCK"): NfseAdapter {
  if (provider === "NFSE_NACIONAL" && process.env.NODE_ENV === "production") {
    if (!nacionalAdapter) nacionalAdapter = new NacionalNfseAdapter();
    return nacionalAdapter;
  }
  if (!mockAdapter) mockAdapter = new MockNfseAdapter();
  return mockAdapter;
}

export type {
  NfseAdapter,
  NfseIssueInput,
  NfseIssueResult,
  NfseConsultResult,
} from "./types";
