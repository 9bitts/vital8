import { MockBillingAdapter } from "./mock.adapter";
import { StripeBillingAdapter } from "./stripe.adapter";
import { isStripeConfigured } from "./stripe-client";
import type { BillingAdapter } from "./types";

let adapter: BillingAdapter | null = null;

export function getBillingAdapter(): BillingAdapter {
  if (!adapter) {
    adapter = isStripeConfigured()
      ? new StripeBillingAdapter()
      : new MockBillingAdapter();
  }
  return adapter;
}

export { isStripeConfigured } from "./stripe-client";
export type { BillingAdapter, BillingCheckoutInput, BillingWebhookEvent } from "./types";
