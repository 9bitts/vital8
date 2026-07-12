import { NextResponse } from "next/server";
import { adminPrisma } from "@/lib/db/admin-client";
import { getBillingAdapter } from "@/lib/integrations/billing";
import {
  isStripeEventProcessed,
  markStripeEventFailed,
  markStripeEventProcessed,
} from "@/lib/integrations/billing/processed-stripe-event.service";
import {
  changePlan,
  markInadimplente,
} from "@/modules/admin/services/subscription.service";
import type { SubscriptionCycle, SubscriptionPlan } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const adapter = getBillingAdapter();
  const event = await adapter.handleWebhook(body, signature, rawBody);

  if (!event) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (await isStripeEventProcessed(event.id)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    if (event.type === "checkout.session.completed" && event.status === "paid" && event.plan) {
      await changePlan(
        event.organizationId,
        event.plan as SubscriptionPlan,
        (event.cycle ?? "MONTHLY") as SubscriptionCycle,
      );
      await adminPrisma.subscription.update({
        where: { organizationId: event.organizationId },
        data: {
          externalCustomerId: event.externalCustomerId ?? undefined,
          externalSubscriptionId: event.externalSubscriptionId ?? undefined,
        },
      });
    }

    if (event.type === "customer.subscription.updated") {
      if (event.status === "paid" && event.plan) {
        await changePlan(
          event.organizationId,
          event.plan,
          (event.cycle ?? "MONTHLY") as SubscriptionCycle,
        );
      } else if (event.status === "past_due") {
        await markInadimplente(event.organizationId);
      }
      if (event.externalSubscriptionId || event.externalCustomerId) {
        await adminPrisma.subscription.update({
          where: { organizationId: event.organizationId },
          data: {
            externalSubscriptionId: event.externalSubscriptionId ?? undefined,
            externalCustomerId: event.externalCustomerId ?? undefined,
          },
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      await adminPrisma.subscription.update({
        where: { organizationId: event.organizationId },
        data: { status: "CANCELADA" },
      });
    }

    if (event.type === "invoice.payment_failed") {
      await markInadimplente(event.organizationId);
    }

    await markStripeEventProcessed({
      eventId: event.id,
      type: event.type,
      organizationId: event.organizationId,
    });

    await adminPrisma.billingWebhookEvent.create({
      data: {
        eventId: event.id,
        organizationId: event.organizationId,
        eventType: event.type,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Webhook processing failed";
    await markStripeEventFailed({
      eventId: event.id,
      type: event.type,
      error: message,
      organizationId: event.organizationId,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
