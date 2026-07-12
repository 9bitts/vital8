import type { SubscriptionCycle, SubscriptionPlan } from "@/generated/prisma/client";

export type BillingCheckoutInput = {
  organizationId: string;
  plan: SubscriptionPlan;
  cycle: SubscriptionCycle;
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
  plan?: SubscriptionPlan;
  cycle?: SubscriptionCycle;
  status?: "paid" | "failed" | "cancelled" | "past_due";
  externalSubscriptionId?: string;
  externalCustomerId?: string;
};

export interface BillingAdapter {
  createCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutResult>;
  handleWebhook(
    payload: unknown,
    signature: string | null,
    rawBody?: string,
  ): Promise<BillingWebhookEvent | null>;
}
