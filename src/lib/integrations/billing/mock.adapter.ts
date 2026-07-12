import { createHmac, timingSafeEqual } from "crypto";
import type { BillingAdapter, BillingCheckoutInput, BillingCheckoutResult, BillingWebhookEvent } from "./types";

const MOCK_SECRET = process.env.BILLING_WEBHOOK_SECRET ?? "vital8-billing-mock-secret";

function verifyMockSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return process.env.NODE_ENV !== "production";
  const expected = createHmac("sha256", MOCK_SECRET).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/** Mock billing — checkout fake em dev; interface compatível com Stripe. */
export class MockBillingAdapter implements BillingAdapter {
  async createCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutResult> {
    const sessionId = `mock_${input.organizationId}_${input.plan}_${Date.now()}`;
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const checkoutUrl = `${base}/checkout/mock?session=${sessionId}&org=${input.organizationId}&plan=${input.plan}&cycle=${input.cycle}&return=${encodeURIComponent(input.successUrl)}`;
    if (process.env.NODE_ENV === "development") {
      console.log(`[Vital8 Billing Mock] checkout ${sessionId}`);
    }
    return { checkoutUrl, sessionId };
  }

  async handleWebhook(
    payload: unknown,
    signature: string | null,
    rawBody = "",
  ): Promise<BillingWebhookEvent | null> {
    if (!verifyMockSignature(rawBody || JSON.stringify(payload), signature)) {
      return null;
    }
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
