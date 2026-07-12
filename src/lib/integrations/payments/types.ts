export type PaymentLinkInput = {
  organizationId: string;
  amountCents: number;
  description: string;
  patientName: string;
};

export type PaymentLinkResult = {
  linkId: string;
  url: string;
  pixCopyPaste: string;
  status: "PENDING" | "PAID" | "EXPIRED";
};

export interface PaymentsAdapter {
  createLink(input: PaymentLinkInput): Promise<PaymentLinkResult>;
  getStatus(linkId: string): Promise<PaymentLinkResult["status"]>;
}
