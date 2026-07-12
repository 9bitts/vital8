import { adminPrisma } from "@/lib/db/admin-client";

const MAX_ERROR_LEN = 500;

export async function isStripeEventProcessed(eventId: string): Promise<boolean> {
  const row = await adminPrisma.processedStripeEvent.findUnique({
    where: { eventId },
    select: { status: true },
  });
  return row?.status === "PROCESSED";
}

export async function markStripeEventProcessed(params: {
  eventId: string;
  type: string;
  organizationId?: string;
}): Promise<void> {
  try {
    await adminPrisma.processedStripeEvent.upsert({
      where: { eventId: params.eventId },
      create: {
        eventId: params.eventId,
        type: params.type,
        status: "PROCESSED",
        organizationId: params.organizationId,
      },
      update: {
        type: params.type,
        status: "PROCESSED",
        error: null,
        organizationId: params.organizationId,
        processedAt: new Date(),
      },
    });
  } catch (e) {
    console.error("[STRIPE-DEDUP-WRITE-FAIL]", params.eventId, e);
  }
}

export async function markStripeEventFailed(params: {
  eventId: string;
  type: string;
  error: string;
  organizationId?: string;
}): Promise<void> {
  try {
    const err = params.error.slice(0, MAX_ERROR_LEN);
    await adminPrisma.processedStripeEvent.upsert({
      where: { eventId: params.eventId },
      create: {
        eventId: params.eventId,
        type: params.type,
        status: "FAILED",
        error: err,
        organizationId: params.organizationId,
      },
      update: {
        type: params.type,
        status: "FAILED",
        error: err,
        organizationId: params.organizationId,
        processedAt: new Date(),
      },
    });
  } catch (e) {
    console.error("[STRIPE-DEDUP-WRITE-FAIL]", params.eventId, e);
  }
}
