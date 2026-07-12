import type { TissTransportAdapter, TissTransportResult } from "./types";

export class MockTissTransportAdapter implements TissTransportAdapter {
  async sendBatch(
    _xml: string,
    metadata: { batchId: string; ansRegistration: string },
  ): Promise<TissTransportResult> {
    return {
      protocol: `MOCK-${metadata.ansRegistration}-${metadata.batchId.slice(-8).toUpperCase()}`,
      sentAt: new Date(),
    };
  }
}
