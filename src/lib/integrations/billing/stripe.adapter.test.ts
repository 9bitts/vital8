import { describe, expect, it, vi, beforeEach } from "vitest";
import { StripeBillingAdapter } from "./stripe.adapter";

vi.mock("./stripe-customer", () => ({
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue("cus_123"),
}));

vi.mock("./stripe-checkout", () => ({
  createVital8SubscriptionCheckoutSession: vi.fn().mockResolvedValue({
    id: "cs_test",
    url: "https://checkout.stripe.com/test",
  }),
}));

vi.mock("./stripe-client", () => ({
  isStripeConfigured: vi.fn().mockReturnValue(true),
  constructStripeEvent: vi.fn(),
  getStripeClient: vi.fn(),
}));

import { constructStripeEvent } from "./stripe-client";

describe("StripeBillingAdapter", () => {
  const adapter = new StripeBillingAdapter();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("cria checkout com URL do Stripe", async () => {
    const result = await adapter.createCheckout({
      organizationId: "org1",
      plan: "PRO",
      cycle: "MONTHLY",
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    });

    expect(result.checkoutUrl).toContain("checkout.stripe.com");
    expect(result.sessionId).toBe("cs_test");
  });

  it("parseia checkout.session.completed vital8_saas", async () => {
    vi.mocked(constructStripeEvent).mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {
            planKind: "vital8_saas",
            organizationId: "org1",
            plan: "PRO",
            cycle: "MONTHLY",
          },
          payment_status: "paid",
          subscription: "sub_1",
          customer: "cus_1",
          client_reference_id: "org1",
        },
      },
    } as never);

    const event = await adapter.handleWebhook(
      {},
      "sig",
      '{"type":"checkout.session.completed"}',
    );

    expect(event?.organizationId).toBe("org1");
    expect(event?.plan).toBe("PRO");
    expect(event?.status).toBe("paid");
  });

  it("ignora eventos sem planKind vital8_saas", async () => {
    vi.mocked(constructStripeEvent).mockReturnValue({
      id: "evt_2",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { planKind: "other" },
          payment_status: "paid",
        },
      },
    } as never);

    const event = await adapter.handleWebhook({}, "sig", "{}");
    expect(event).toBeNull();
  });
});
