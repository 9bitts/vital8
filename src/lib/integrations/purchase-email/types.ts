export type PurchaseEmailResult = { messageId: string; sentAt: Date };

export interface PurchaseEmailAdapter {
  sendPurchaseOrderPdf(
    to: string,
    subject: string,
    pdfContent: string,
    metadata: { orderId: string },
  ): Promise<PurchaseEmailResult>;
}
