import { NextResponse } from "next/server";
import { getBillingAdapter } from "@/lib/integrations/billing/mock.adapter";
import { changePlan } from "@/modules/admin/services/subscription.service";
import type { SubscriptionCycle, SubscriptionPlan } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const processed = new Set<string>();

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const body = await request.json();
  const adapter = getBillingAdapter();
  const event = await adapter.handleWebhook(body, signature);

  if (!event) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (processed.has(event.id)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  processed.add(event.id);

  if (event.type === "checkout.session.completed" && event.status === "paid" && event.plan) {
    await changePlan(
      event.organizationId,
      event.plan as SubscriptionPlan,
      (body.cycle as SubscriptionCycle) ?? "MONTHLY",
    );
  }

  return NextResponse.json({ ok: true, idempotent: true });
}
