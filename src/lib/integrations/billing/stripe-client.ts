import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY não configurada");
    }
    stripeInstance = new Stripe(key, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
    });
  }
  return stripeInstance;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function constructStripeEvent(
  rawBody: string,
  signature: string | null,
  secret: string,
): Stripe.Event | null {
  if (!signature) return null;
  try {
    return getStripeClient().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return null;
  }
}
