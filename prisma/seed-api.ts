import type { PrismaClient } from "../src/generated/prisma/client";
import { createApiClient, createApiKey } from "../src/modules/api/services/api-key.service";
import { DEMO_ORG_SLUG } from "../src/modules/api/lib/scopes";

export async function seedApi(prisma: PrismaClient, organizationId: string, orgSlug: string) {
  if (orgSlug !== DEMO_ORG_SLUG) return null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const client = await createApiClient({
    organizationId,
    name: "Doctor8",
    environment: "SANDBOX",
  });

  const { key, token } = await createApiKey({
    apiClientId: client.id,
    organizationId,
    environment: "SANDBOX",
    scopes: [
      "patients:read",
      "patients:write",
      "appointments:read",
      "appointments:write",
      "schedule:read",
      "webhooks:manage",
    ],
  });

  const webhook = await prisma.webhookEndpoint.create({
    data: {
      organizationId,
      apiClientId: client.id,
      url: `${baseUrl}/api/webhooks/echo`,
      secret: "whsec_demo_doctor8_seed",
      events: [
        "patient.created",
        "appointment.created",
        "appointment.status_changed",
      ],
    },
  });

  await prisma.apiRequestLog.createMany({
    data: [
      {
        organizationId,
        apiClientId: client.id,
        apiKeyId: key.id,
        method: "GET",
        route: "/api/v1/ping",
        statusCode: 200,
        latencyMs: 42,
        ipAddress: "127.0.0.1",
      },
      {
        organizationId,
        apiClientId: client.id,
        apiKeyId: key.id,
        method: "GET",
        route: "/api/v1/patients",
        statusCode: 200,
        latencyMs: 118,
        ipAddress: "127.0.0.1",
      },
    ],
  });

  await prisma.webhookDelivery.create({
    data: {
      webhookEndpointId: webhook.id,
      organizationId,
      eventType: "patient.created",
      payload: {
        event: "patient.created",
        id: "seed-example-patient-id",
        occurredAt: new Date().toISOString(),
      },
      status: "DELIVERED",
      attemptCount: 1,
      lastAttemptAt: new Date(),
      responseStatus: 200,
    },
  });

  return { client, key, token, webhook };
}
