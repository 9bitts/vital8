import { MockRndsAdapter } from "./mock.adapter";
import type { RndsAdapter } from "./types";

let adapter: RndsAdapter | null = null;

export function getRndsAdapter(): RndsAdapter {
  if (!adapter) {
    adapter = new MockRndsAdapter();
  }
  return adapter;
}

export type { RndsAdapter, RndsAdapterConfig, RndsSubmitResult } from "./types";
export { getRndsToken, simulateTokenExpiry, clearRndsTokenCacheForTests } from "./token-cache";
export { translateOperationOutcome } from "./mock.adapter";
