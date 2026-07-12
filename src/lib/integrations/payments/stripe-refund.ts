import { getStripeClient, isStripeConfigured } from "@/lib/integrations/billing/stripe-client";

export type RefundResult = {
  refunded: boolean;
  alreadyRefunded?: boolean;
  reason?: "not_charged";
  error?: boolean;
};

export async function refundPaymentIntentIdempotent(
  paymentIntentId: string,
  reason: string,
): Promise<RefundResult> {
  if (!isStripeConfigured()) {
    return { refunded: false, error: true };
  }

  try {
    const intent = await getStripeClient().paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["latest_charge"] },
    );

    if (intent.status !== "succeeded") {
      return { refunded: false, reason: "not_charged" };
    }

    const charge = intent.latest_charge as { refunded?: boolean; amount_refunded?: number } | null;
    if (charge && (charge.refunded || (charge.amount_refunded ?? 0) > 0)) {
      return { refunded: true, alreadyRefunded: true };
    }

    await getStripeClient().refunds.create(
      {
        payment_intent: paymentIntentId,
        metadata: { reason, source: "vital8-refund" },
      },
      { idempotencyKey: `refund-${paymentIntentId}` },
    );

    return { refunded: true };
  } catch (e) {
    console.error(`[STRIPE-REFUND-FAIL] ${paymentIntentId}:`, e);
    return { refunded: false, error: true };
  }
}
