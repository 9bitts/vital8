import { MockNfseAdapter } from "./mock.adapter";
import type { NfseAdapter } from "./types";

let adapter: NfseAdapter | null = null;

export function getNfseAdapter(): NfseAdapter {
  if (!adapter) adapter = new MockNfseAdapter();
  return adapter;
}

export type { NfseAdapter, NfseIssueInput, NfseIssueResult } from "./types";
