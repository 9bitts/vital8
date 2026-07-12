import { MockAdsAdapter, MetaConversionsAdapter } from "./mock.adapter";
import type { AdsAdapter } from "./types";

let adapter: AdsAdapter | null = null;

function isNonDevEnv(): boolean {
  const env = process.env.NODE_ENV ?? "development";
  return env !== "development" && env !== "test";
}

export function getAdsAdapter(): AdsAdapter {
  if (!adapter) {
    if (process.env.META_PIXEL_ID && isNonDevEnv()) {
      adapter = new MetaConversionsAdapter();
    } else {
      adapter = new MockAdsAdapter();
    }
  }
  return adapter;
}

export type { AdsAdapter, AdsEventPayload } from "./types";
