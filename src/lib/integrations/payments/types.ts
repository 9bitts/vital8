export type PaymentLinkInput = {
  organizationId: string;
  amountCents: number;
  description: string;
  patientName: string;
  patientId?: string;
  receivableId?: string;
};

export type PaymentLinkResult = {
  linkId: string;
  url: string;
  pixCopyPaste: string;
  pixQrCodeBase64?: string;
  status: "PENDING" | "PAID" | "EXPIRED";
  externalId?: string;
};

export type PaymentWebhookResult = {
  linkId: string;
  externalId?: string;
  status: "PAID" | "EXPIRED" | "CANCELLED";
  paidAmountCents?: number;
  stripeEventId?: string;
};

export type PaymentWebhookOptions = {
  signature?: string | null;
  rawBody?: string;
};

export interface PaymentsAdapter {
  createLink(input: PaymentLinkInput): Promise<PaymentLinkResult>;
  getStatus(linkId: string): Promise<PaymentLinkResult["status"]>;
  handleWebhook?(
    payload: unknown,
    options?: PaymentWebhookOptions,
  ): Promise<PaymentWebhookResult | null>;
}
