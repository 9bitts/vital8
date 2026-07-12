import type { PurchaseEmailAdapter, PurchaseEmailResult } from "./types";

export class MockPurchaseEmailAdapter implements PurchaseEmailAdapter {
  async sendPurchaseOrderPdf(
    to: string,
    _subject: string,
    _pdfContent: string,
    metadata: { orderId: string },
  ): Promise<PurchaseEmailResult> {
    console.log(`[Vital8 Purchase Email] Pedido ${metadata.orderId} → ${to}`);
    return { messageId: `MOCK-${metadata.orderId.slice(-8)}`, sentAt: new Date() };
  }
}
