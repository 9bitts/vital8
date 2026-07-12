import { NextResponse } from "next/server";
import {
  getPaymentsAdapter,
  reconcilePaymentWebhook,
} from "@/lib/integrations/payments";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const stripeSignature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (stripeSignature) {
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const adapter = getPaymentsAdapter();
    if (!adapter.handleWebhook) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const result = await adapter.handleWebhook(payload, {
      signature: stripeSignature,
      rawBody,
    });
    if (!result) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const link = await reconcilePaymentWebhook(result);
    return NextResponse.json({ ok: true, linkId: link?.id ?? null });
  }

  const secret = process.env.PAYMENTS_WEBHOOK_SECRET;
  const signature = request.headers.get("x-vital8-signature");
  if (secret && signature !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const adapter = getPaymentsAdapter();
  if (!adapter.handleWebhook) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await adapter.handleWebhook(payload);
  if (!result) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const link = await reconcilePaymentWebhook(result);
  return NextResponse.json({ ok: true, linkId: link?.id ?? null });
}
