import { randomUUID } from "crypto";
import type Stripe from "stripe";
import {
  constructStripeEvent,
  getStripeClient,
  isStripeConfigured,
} from "@/lib/integrations/billing/stripe-client";
import { getPatientPaymentMethodTypes } from "@/lib/integrations/billing/stripe-payment-methods";
import type {
  PaymentLinkInput,
  PaymentLinkResult,
  PaymentWebhookResult,
  PaymentsAdapter,
} from "./types";

export class StripePaymentsAdapter implements PaymentsAdapter {
  async createLink(input: PaymentLinkInput): Promise<PaymentLinkResult> {
    if (!isStripeConfigured()) {
      throw new Error("Stripe não configurado");
    }

    const linkId = randomUUID();
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const methodTypes = getPatientPaymentMethodTypes("brl");

    const session = await getStripeClient().checkout.sessions.create({
      mode: "payment",
      payment_method_types:
        methodTypes as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: input.amountCents,
            product_data: {
              name: input.description.slice(0, 120),
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/pagamento/${linkId}?success=1`,
      cancel_url: `${base}/pagamento/${linkId}`,
      metadata: {
        linkId,
        organizationId: input.organizationId,
        receivableId: input.receivableId ?? "",
        patientId: input.patientId ?? "",
        planKind: "vital8_patient",
      },
      client_reference_id: linkId,
    });

    if (!session.url) {
      throw new Error("Stripe não retornou URL de pagamento");
    }

    return {
      linkId,
      url: session.url,
      pixCopyPaste: "",
      status: "PENDING",
      externalId: session.id,
    };
  }

  async getStatus(linkId: string): Promise<PaymentLinkResult["status"]> {
    void linkId;
    return "PENDING";
  }

  async handleWebhook(
    payload: unknown,
    options?: { signature?: string | null; rawBody?: string },
  ): Promise<PaymentWebhookResult | null> {
    const secret =
      process.env.STRIPE_PAYMENTS_WEBHOOK_SECRET?.trim() ||
      process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret || !options?.rawBody) return null;

    const event =
      constructStripeEvent(options.rawBody, options.signature ?? null, secret) ??
      (payload as Stripe.Event | null);
    if (!event?.id) return null;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.planKind !== "vital8_patient") return null;
      const linkId =
        session.metadata?.linkId || session.client_reference_id || "";
      if (!linkId) return null;

      return {
        linkId,
        externalId: session.id,
        status: session.payment_status === "paid" ? "PAID" : "CANCELLED",
        paidAmountCents: session.amount_total ?? undefined,
        stripeEventId: event.id,
      };
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.planKind !== "vital8_patient") return null;
      const linkId =
        session.metadata?.linkId || session.client_reference_id || "";
      if (!linkId) return null;
      return {
        linkId,
        externalId: session.id,
        status: "EXPIRED",
        stripeEventId: event.id,
      };
    }

    return null;
  }
}
