import { MockLabIntegrationAdapter } from "./mock.adapter";
import type { LabIntegrationAdapter } from "./types";

let adapter: LabIntegrationAdapter | null = null;

export function getLabIntegrationAdapter(): LabIntegrationAdapter {
  if (!adapter) {
    adapter = new MockLabIntegrationAdapter();
  }
  return adapter;
}

export type { LabIntegrationAdapter, LabOrderInput, LabResultPayload } from "./types";
export { clearMockLabOrdersForTests } from "./mock.adapter";
