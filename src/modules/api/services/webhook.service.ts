import { createHmac } from "crypto";
import type { Prisma } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";
import { hasOrgFeature } from "@/lib/features/subscription.service";
import type { WebhookEventType } from "../lib/scopes";

export type WebhookPayload = {
  event: WebhookEventType;
  id: string;
  occurredAt: string;
  [key: string]: unknown;
};

export async function emitWebhookEvent(
  organizationId: string,
  eventType: WebhookEventType,
  payload: WebhookPayload,
) {
  const ok = await hasOrgFeature(organizationId, "webhooks");
  if (!ok) return;

  const endpoints = await adminPrisma.webhookEndpoint.findMany({
    where: {
      organizationId,
      isActive: true,
      events: { has: eventType },
    },
  });

  for (const ep of endpoints) {
    await adminPrisma.webhookDelivery.create({
      data: {
        webhookEndpointId: ep.id,
        organizationId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
        status: "PENDING",
        nextRetryAt: new Date(),
      },
    });
  }
}

export function signWebhookPayload(secret: string, timestamp: number, body: string) {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

const BACKOFF_MINUTES = [1, 5, 15, 60, 240];

export async function processWebhookDeliveries(limit = 50) {
  const pending = await adminPrisma.webhookDelivery.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    include: { webhookEndpoint: true },
    take: limit,
  });

  for (const d of pending) {
    const ep = d.webhookEndpoint;
    if (!ep.isActive) continue;

    const body = JSON.stringify(d.payload);
    const ts = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload(ep.secret, ts, body);

    try {
      const res = await fetch(ep.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Vital8-Signature": signature,
          "X-Vital8-Event": d.eventType,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        await adminPrisma.webhookDelivery.update({
          where: { id: d.id },
          data: {
            status: "DELIVERED",
            attemptCount: d.attemptCount + 1,
            lastAttemptAt: new Date(),
            responseStatus: res.status,
          },
        });
        await adminPrisma.webhookEndpoint.update({
          where: { id: ep.id },
          data: { consecutiveFailures: 0 },
        });
      } else {
        await handleFailure(d.id, ep.id, d.attemptCount, res.status, `HTTP ${res.status}`);
      }
    } catch (e) {
      await handleFailure(
        d.id,
        ep.id,
        d.attemptCount,
        null,
        e instanceof Error ? e.message : "Network error",
      );
    }
  }
}

async function handleFailure(
  deliveryId: string,
  endpointId: string,
  attemptCount: number,
  responseStatus: number | null,
  error: string,
) {
  const nextAttempt = attemptCount + 1;
  if (nextAttempt >= 5) {
    await adminPrisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "DLQ",
        attemptCount: nextAttempt,
        lastAttemptAt: new Date(),
        responseStatus: responseStatus ?? undefined,
        lastError: error,
      },
    });
    const ep = await adminPrisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: { consecutiveFailures: { increment: 1 } },
    });
    if (ep.consecutiveFailures >= 10) {
      await adminPrisma.webhookEndpoint.update({
        where: { id: endpointId },
        data: { isActive: false, disabledAt: new Date() },
      });
    }
    return;
  }

  const backoffMin = BACKOFF_MINUTES[nextAttempt - 1] ?? 240;
  const nextRetry = new Date(Date.now() + backoffMin * 60_000);
  await adminPrisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "FAILED",
      attemptCount: nextAttempt,
      lastAttemptAt: new Date(),
      nextRetryAt: nextRetry,
      responseStatus: responseStatus ?? undefined,
      lastError: error,
    },
  });
}
