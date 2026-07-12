import type { SubscriptionCycle, SubscriptionPlan } from "@/generated/prisma/client";

export function getSubscriptionPaymentMethodTypes(currency = "brl"): string[] {
  const cur = currency.toLowerCase();
  if (cur === "brl") {
    if (process.env.STRIPE_SUBSCRIPTION_PIX === "1") {
      return ["card", "boleto", "pix"];
    }
    return ["card", "boleto"];
  }
  return ["card"];
}

export function getPatientPaymentMethodTypes(currency = "brl"): string[] {
  const cur = currency.toLowerCase();
  if (cur === "brl") {
    return ["card", "pix"];
  }
  return ["card"];
}

export function needsBrazilTaxId(currency = "brl"): boolean {
  return currency.toLowerCase() === "brl";
}

const PRICE_ENV_KEYS: Record<
  SubscriptionPlan,
  Record<SubscriptionCycle, string>
> = {
  BASICO: {
    MONTHLY: "STRIPE_PRICE_BASICO_MONTHLY",
    ANNUAL: "STRIPE_PRICE_BASICO_ANNUAL",
  },
  PRO: {
    MONTHLY: "STRIPE_PRICE_PRO_MONTHLY",
    ANNUAL: "STRIPE_PRICE_PRO_ANNUAL",
  },
  ENTERPRISE: {
    MONTHLY: "STRIPE_PRICE_ENTERPRISE_MONTHLY",
    ANNUAL: "STRIPE_PRICE_ENTERPRISE_ANNUAL",
  },
};

export function getVital8PlanPriceId(
  plan: SubscriptionPlan,
  cycle: SubscriptionCycle,
): string | null {
  const envKey = PRICE_ENV_KEYS[plan][cycle];
  return process.env[envKey]?.trim() || null;
}

export function friendlyStripeCheckoutError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("payment_method_types") || m.includes("payment method type")) {
    return "Forma de pagamento não disponível. Tente novamente.";
  }
  if (m.includes("no such price")) {
    return "Preço da assinatura não encontrado no Stripe. Verifique os STRIPE_PRICE_* no servidor.";
  }
  if (m.includes("api key") || m.includes("invalid api key")) {
    return "Chave do Stripe inválida. Verifique STRIPE_SECRET_KEY.";
  }
  if (m.includes("tax id collection") || m.includes("customer_update")) {
    return "Não foi possível abrir o checkout (CPF/CNPJ). Tente novamente.";
  }
  if (message && message.length < 200) {
    return message;
  }
  return "Não foi possível abrir o checkout. Tente novamente em instantes.";
}
