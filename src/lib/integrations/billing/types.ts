export type BillingCheckoutInput = {
  organizationId: string;
  plan: "BASICO" | "PRO" | "ENTERPRISE";
  cycle: "MONTHLY" | "ANNUAL";
  successUrl: string;
  cancelUrl: string;
};

export type BillingCheckoutResult = {
  checkoutUrl: string;
  sessionId: string;
};

export type BillingWebhookEvent = {
  id: string;
  type: string;
  organizationId: string;
  plan?: "BASICO" | "PRO" | "ENTERPRISE";
  status?: "paid" | "failed";
};

export interface BillingAdapter {
  createCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutResult>;
  handleWebhook(payload: unknown, signature: string | null): Promise<BillingWebhookEvent | null>;
}
