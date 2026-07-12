import type { BillingAdapter, BillingCheckoutInput, BillingCheckoutResult, BillingWebhookEvent } from "./types";

/** Mock billing — checkout fake em dev; interface compatível com Stripe. */
export class MockBillingAdapter implements BillingAdapter {
  async createCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutResult> {
    const sessionId = `mock_${input.organizationId}_${input.plan}_${Date.now()}`;
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const checkoutUrl = `${base}/checkout/mock?session=${sessionId}&org=${input.organizationId}&plan=${input.plan}&cycle=${input.cycle}&return=${encodeURIComponent(input.successUrl)}`;
    console.log(`[Vital8 Billing Mock] checkout ${sessionId} → ${checkoutUrl}`);
    return { checkoutUrl, sessionId };
  }

  async handleWebhook(payload: unknown, signature: string | null): Promise<BillingWebhookEvent | null> {
    void signature;
    const body = payload as Record<string, string>;
    if (!body?.sessionId || !body?.organizationId) return null;
    return {
      id: body.sessionId,
      type: "checkout.session.completed",
      organizationId: body.organizationId,
      plan: body.plan as BillingWebhookEvent["plan"],
      status: "paid",
    };
  }
}

export function getBillingAdapter(): BillingAdapter {
  return new MockBillingAdapter();
}
