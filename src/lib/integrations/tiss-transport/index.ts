import { MockTissTransportAdapter } from "./mock.adapter";
import type { TissTransportAdapter } from "./types";

let adapter: TissTransportAdapter | null = null;

export function getTissTransportAdapter(): TissTransportAdapter {
  if (!adapter) {
    adapter = new MockTissTransportAdapter();
  }
  return adapter;
}

export type { TissTransportAdapter, TissTransportResult } from "./types";
