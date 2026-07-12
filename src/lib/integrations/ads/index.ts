import { MockAdsAdapter, MetaConversionsAdapter } from "./mock.adapter";
import type { AdsAdapter } from "./types";

let adapter: AdsAdapter | null = null;

export function getAdsAdapter(): AdsAdapter {
  if (!adapter) {
    if (process.env.META_PIXEL_ID && process.env.NODE_ENV === "production") {
      adapter = new MetaConversionsAdapter();
    } else {
      adapter = new MockAdsAdapter();
    }
  }
  return adapter;
}

export type { AdsAdapter, AdsEventPayload } from "./types";
