export type TissTransportResult = {
  protocol: string;
  sentAt: Date;
};

export interface TissTransportAdapter {
  sendBatch(xml: string, metadata: { batchId: string; ansRegistration: string }): Promise<TissTransportResult>;
}
