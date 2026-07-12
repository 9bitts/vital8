import type { PrescriptionProviderType } from "@/generated/prisma/client";
import { LocalDrugCatalogAdapter } from "./local.adapter";
import { MemedPrescriptionAdapter } from "./memed.adapter";
import type { PrescriptionProviderAdapter } from "./types";

let localAdapter: PrescriptionProviderAdapter | null = null;
let memedAdapter: PrescriptionProviderAdapter | null = null;

export function getPrescriptionProvider(
  provider: PrescriptionProviderType = "LOCAL",
): PrescriptionProviderAdapter {
  if (provider === "MEMED") {
    if (!memedAdapter) memedAdapter = new MemedPrescriptionAdapter();
    return memedAdapter;
  }
  if (!localAdapter) localAdapter = new LocalDrugCatalogAdapter();
  return localAdapter;
}

export type {
  PrescriptionProviderAdapter,
  DrugSearchResult,
  MemedSessionInput,
  MemedSessionResult,
  MemedWebhookResult,
} from "./types";
