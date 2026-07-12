import { describe, expect, it, vi, beforeEach } from "vitest";
import { StripePaymentsAdapter } from "./stripe.adapter";

const createMock = vi.fn();

vi.mock("@/lib/integrations/billing/stripe-client", () => ({
  isStripeConfigured: vi.fn().mockReturnValue(true),
  getStripeClient: vi.fn(() => ({
    checkout: { sessions: { create: createMock } },
  })),
  constructStripeEvent: vi.fn(),
}));

import { constructStripeEvent } from "@/lib/integrations/billing/stripe-client";

describe("StripePaymentsAdapter", () => {
  const adapter = new StripePaymentsAdapter();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    createMock.mockResolvedValue({
      id: "cs_pay",
      url: "https://checkout.stripe.com/pay",
    });
  });

  it("cria link de pagamento hosted checkout", async () => {
    const result = await adapter.createLink({
      organizationId: "org1",
      amountCents: 15000,
      description: "Consulta",
      patientName: "Ana",
      patientId: "p1",
      receivableId: "r1",
    });

    expect(result.url).toContain("checkout.stripe.com");
    expect(result.externalId).toBe("cs_pay");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        metadata: expect.objectContaining({ planKind: "vital8_patient" }),
      }),
    );
  });

  it("parseia checkout.session.completed de paciente", async () => {
    vi.mocked(constructStripeEvent).mockReturnValue({
      id: "evt_pay",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_pay",
          metadata: { planKind: "vital8_patient", linkId: "link1" },
          payment_status: "paid",
          amount_total: 15000,
          client_reference_id: "link1",
        },
      },
    } as never);

    const result = await adapter.handleWebhook(
      {},
      { signature: "sig", rawBody: "{}" },
    );

    expect(result?.linkId).toBe("link1");
    expect(result?.status).toBe("PAID");
    expect(result?.stripeEventId).toBe("evt_pay");
  });
});
