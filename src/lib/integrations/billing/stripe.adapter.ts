import type { SubscriptionCycle, SubscriptionPlan } from "@/generated/prisma/client";
import type Stripe from "stripe";
import { getOrCreateStripeCustomer } from "./stripe-customer";
import { createVital8SubscriptionCheckoutSession } from "./stripe-checkout";
import {
  constructStripeEvent,
  getStripeClient,
  isStripeConfigured,
} from "./stripe-client";
import type {
  BillingAdapter,
  BillingCheckoutInput,
  BillingCheckoutResult,
  BillingWebhookEvent,
} from "./types";

function parseOrganizationId(
  metadata?: Stripe.Metadata | null,
  clientReferenceId?: string | null,
): string | undefined {
  return metadata?.organizationId || clientReferenceId || undefined;
}

function parsePlan(metadata?: Stripe.Metadata | null): SubscriptionPlan | undefined {
  const plan = metadata?.plan;
  if (plan === "BASICO" || plan === "PRO" || plan === "ENTERPRISE") return plan;
  return undefined;
}

function parseCycle(metadata?: Stripe.Metadata | null): SubscriptionCycle | undefined {
  const cycle = metadata?.cycle;
  if (cycle === "MONTHLY" || cycle === "ANNUAL") return cycle;
  return undefined;
}

export class StripeBillingAdapter implements BillingAdapter {
  async createCheckout(input: BillingCheckoutInput): Promise<BillingCheckoutResult> {
    if (!isStripeConfigured()) {
      throw new Error("Stripe não configurado");
    }

    const customerId = await getOrCreateStripeCustomer(input.organizationId);
    const session = await createVital8SubscriptionCheckoutSession({
      customerId,
      organizationId: input.organizationId,
      plan: input.plan,
      cycle: input.cycle,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });

    if (!session.url) {
      throw new Error("Stripe não retornou URL de checkout");
    }

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  async handleWebhook(
    payload: unknown,
    signature: string | null,
    rawBody?: string,
  ): Promise<BillingWebhookEvent | null> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret || !rawBody) return null;

    const event =
      constructStripeEvent(rawBody, signature, secret) ??
      (payload as Stripe.Event | null);
    if (!event?.id || !event.type) return null;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.planKind !== "vital8_saas") return null;

      const organizationId = parseOrganizationId(
        session.metadata,
        session.client_reference_id,
      );
      if (!organizationId) return null;

      return {
        id: event.id,
        type: event.type,
        organizationId,
        plan: parsePlan(session.metadata),
        cycle: parseCycle(session.metadata),
        status: session.payment_status === "paid" ? "paid" : "failed",
        externalSubscriptionId:
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id,
        externalCustomerId:
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id,
      };
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.metadata?.planKind !== "vital8_saas") return null;
      const organizationId = parseOrganizationId(sub.metadata);
      if (!organizationId) return null;

      const status =
        sub.status === "active" || sub.status === "trialing"
          ? "paid"
          : sub.status === "past_due" || sub.status === "unpaid"
            ? "past_due"
            : "failed";

      return {
        id: event.id,
        type: event.type,
        organizationId,
        plan: parsePlan(sub.metadata),
        cycle: parseCycle(sub.metadata),
        status,
        externalSubscriptionId: sub.id,
        externalCustomerId:
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
      };
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.metadata?.planKind !== "vital8_saas") return null;
      const organizationId = parseOrganizationId(sub.metadata);
      if (!organizationId) return null;

      return {
        id: event.id,
        type: event.type,
        organizationId,
        status: "cancelled",
        externalSubscriptionId: sub.id,
      };
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const organizationId = parseOrganizationId(invoice.metadata);
      if (!organizationId) {
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (customerId) {
          const local = await getStripeClient().customers.retrieve(customerId);
          if (!local.deleted && local.metadata?.planKind === "vital8_saas") {
            return {
              id: event.id,
              type: event.type,
              organizationId: local.metadata.organizationId,
              status: "past_due",
            };
          }
        }
        return null;
      }

      return {
        id: event.id,
        type: event.type,
        organizationId,
        status: "past_due",
      };
    }

    return null;
  }
}
