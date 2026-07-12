import { isStripeConfigured } from "@/lib/integrations/billing/stripe-client";
import { getVital8PlanPriceId } from "@/lib/integrations/billing/stripe-payment-methods";

export type StripeReadiness = {
  configured: boolean;
  publishableKey: boolean;
  billingWebhook: boolean;
  paymentsWebhook: boolean;
  priceIdsConfigured: boolean;
  productionReady: boolean;
  note: string;
};

export function getStripeReadiness(): StripeReadiness {
  const configured = isStripeConfigured();
  const publishableKey = Boolean(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim(),
  );
  const billingWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const paymentsWebhook = Boolean(
    process.env.STRIPE_PAYMENTS_WEBHOOK_SECRET?.trim() ||
      process.env.STRIPE_WEBHOOK_SECRET?.trim(),
  );
  const priceIdsConfigured = Boolean(
    getVital8PlanPriceId("BASICO", "MONTHLY"),
  );
  const productionReady =
    configured && billingWebhook && paymentsWebhook && priceIdsConfigured;

  let note: string;
  if (!configured) {
    note =
      "Stripe não configurado — assinatura usa checkout mock e pagamentos usam PIX mock/Efí.";
  } else if (productionReady) {
    note =
      "Stack Stripe pronto (secret, webhooks, price IDs). Configure endpoints no dashboard Meta/Stripe.";
  } else if (!priceIdsConfigured) {
    note =
      "STRIPE_SECRET_KEY definida. Configure STRIPE_PRICE_* para assinatura SaaS.";
  } else if (!billingWebhook) {
    note = "Adicione STRIPE_WEBHOOK_SECRET e endpoint POST /api/billing/webhook.";
  } else {
    note =
      "Configure STRIPE_PAYMENTS_WEBHOOK_SECRET (ou reutilize STRIPE_WEBHOOK_SECRET) para POST /api/webhooks/payments.";
  }

  return {
    configured,
    publishableKey,
    billingWebhook,
    paymentsWebhook,
    priceIdsConfigured,
    productionReady,
    note,
  };
}
