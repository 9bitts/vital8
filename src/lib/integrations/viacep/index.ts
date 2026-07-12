import { ViaCepAdapter } from "./viacep.adapter";
import type { CepLookupAdapter } from "./types";

let adapter: CepLookupAdapter | null = null;

export function getCepLookupAdapter(): CepLookupAdapter {
  if (!adapter) {
    adapter = new ViaCepAdapter();
  }
  return adapter;
}

export type { ViaCepAddress, CepLookupAdapter } from "./types";
