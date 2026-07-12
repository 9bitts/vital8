import { describe, expect, it, vi, beforeEach } from "vitest";
import { refundPaymentIntentIdempotent } from "./stripe-refund";

const retrieveMock = vi.fn();
const refundsCreateMock = vi.fn();

vi.mock("@/lib/integrations/billing/stripe-client", () => ({
  isStripeConfigured: vi.fn().mockReturnValue(true),
  getStripeClient: vi.fn(() => ({
    paymentIntents: { retrieve: retrieveMock },
    refunds: { create: refundsCreateMock },
  })),
}));

describe("refundPaymentIntentIdempotent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não estorna se payment intent não succeeded", async () => {
    retrieveMock.mockResolvedValue({ status: "requires_payment_method" });
    const result = await refundPaymentIntentIdempotent("pi_1", "test");
    expect(result.refunded).toBe(false);
    expect(result.reason).toBe("not_charged");
  });

  it("estorna payment intent succeeded", async () => {
    retrieveMock.mockResolvedValue({
      status: "succeeded",
      latest_charge: { refunded: false, amount_refunded: 0 },
    });
    refundsCreateMock.mockResolvedValue({ id: "re_1" });

    const result = await refundPaymentIntentIdempotent("pi_2", "cancel");
    expect(result.refunded).toBe(true);
    expect(refundsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_2" }),
      expect.objectContaining({ idempotencyKey: "refund-pi_2" }),
    );
  });
});
