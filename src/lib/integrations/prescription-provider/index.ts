import { LocalDrugCatalogAdapter } from "./local.adapter";
import type { PrescriptionProviderAdapter } from "./types";

let adapter: PrescriptionProviderAdapter | null = null;

export function getPrescriptionProvider(): PrescriptionProviderAdapter {
  if (!adapter) {
    adapter = new LocalDrugCatalogAdapter();
  }
  return adapter;
}

export type { PrescriptionProviderAdapter, DrugSearchResult } from "./types";
