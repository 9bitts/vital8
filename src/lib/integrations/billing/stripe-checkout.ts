import type Stripe from "stripe";
import type { SubscriptionCycle, SubscriptionPlan } from "@/generated/prisma/client";
import { getStripeClient } from "./stripe-client";
import {
  friendlyStripeCheckoutError,
  getSubscriptionPaymentMethodTypes,
  getVital8PlanPriceId,
  needsBrazilTaxId,
} from "./stripe-payment-methods";

function stripeErrorMessage(error: unknown): string {
  const e = error as { raw?: { message?: string }; message?: string };
  return e?.raw?.message || e?.message || "unknown";
}

export function buildVital8SubscriptionCheckoutParams(params: {
  customerId: string;
  priceId: string;
  organizationId: string;
  plan: SubscriptionPlan;
  cycle: SubscriptionCycle;
  successUrl: string;
  cancelUrl: string;
  paymentMethodTypes?: string[];
  includeBrazilTaxId?: boolean;
}) {
  const currency = "brl";
  const methodTypes =
    params.paymentMethodTypes ?? getSubscriptionPaymentMethodTypes(currency);
  const withTaxId =
    params.includeBrazilTaxId ?? needsBrazilTaxId(currency);

  const metadata: Record<string, string> = {
    organizationId: params.organizationId,
    plan: params.plan,
    cycle: params.cycle,
    planKind: "vital8_saas",
  };

  return {
    customer: params.customerId,
    mode: "subscription" as const,
    payment_method_types: methodTypes as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.organizationId,
    metadata,
    subscription_data: { metadata },
    billing_address_collection: "auto" as const,
    ...(withTaxId
      ? {
          tax_id_collection: { enabled: true },
          customer_update: { name: "auto" as const, address: "auto" as const },
        }
      : {}),
  };
}

export async function createVital8SubscriptionCheckoutSession(params: {
  customerId: string;
  organizationId: string;
  plan: SubscriptionPlan;
  cycle: SubscriptionCycle;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const priceId = getVital8PlanPriceId(params.plan, params.cycle);
  if (!priceId) {
    throw new Error(
      `Price ID não configurado para ${params.plan}/${params.cycle}`,
    );
  }

  const attempts = [
    {},
    { paymentMethodTypes: ["card"] as string[] },
    { paymentMethodTypes: ["card"] as string[], includeBrazilTaxId: false },
  ];

  let lastError: unknown;
  for (let i = 0; i < attempts.length; i += 1) {
    const checkoutParams = buildVital8SubscriptionCheckoutParams({
      ...params,
      priceId,
      ...attempts[i],
    });
    try {
      return await getStripeClient().checkout.sessions.create(checkoutParams);
    } catch (error: unknown) {
      lastError = error;
      console.warn(
        `[STRIPE] Subscription checkout attempt ${i + 1}/${attempts.length} failed:`,
        stripeErrorMessage(error),
      );
    }
  }

  const msg = stripeErrorMessage(lastError);
  throw new Error(friendlyStripeCheckoutError(msg));
}
