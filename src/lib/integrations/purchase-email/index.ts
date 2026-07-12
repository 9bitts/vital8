import { MockPurchaseEmailAdapter } from "./mock.adapter";
import type { PurchaseEmailAdapter } from "./types";

let adapter: PurchaseEmailAdapter | null = null;

export function getPurchaseEmailAdapter(): PurchaseEmailAdapter {
  if (!adapter) adapter = new MockPurchaseEmailAdapter();
  return adapter;
}

export type { PurchaseEmailAdapter, PurchaseEmailResult } from "./types";
