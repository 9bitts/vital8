"use server";

import { revalidatePath } from "next/cache";
import { adminPrisma } from "@/lib/db/admin-client";
import { requireAuth } from "@/lib/auth/guards";
import { hasOrgFeature } from "@/lib/features/subscription.service";
import { createAuditLog } from "@/modules/core/services/audit.service";
import type { ApiClientEnvironment } from "@/generated/prisma/client";
import type { ApiScope } from "@/modules/api/lib/scopes";
import { API_SCOPES } from "@/modules/api/lib/scopes";
import {
  createApiClient,
  createApiKey,
  revokeApiKey,
} from "@/modules/api/services/api-key.service";
import { randomBytes } from "crypto";

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

async function requireApiAdmin() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  const enabled = await hasOrgFeature(ctx.organizationId, "public_api");
  if (!enabled) throw new Error("API disponível em planos PRO e ENTERPRISE");
  return ctx;
}

export async function listApiClientsAction() {
  const ctx = await requireApiAdmin();
  return adminPrisma.apiClient.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      keys: { orderBy: { createdAt: "desc" } },
      webhookEndpoints: true,
      _count: { select: { requestLogs: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createApiClientAction(input: {
  name: string;
  environment: ApiClientEnvironment;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireApiAdmin();
    const client = await createApiClient({
      organizationId: ctx.organizationId,
      name: input.name.trim(),
      environment: input.environment,
    });
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "api.client.create",
      entityType: "ApiClient",
      entityId: client.id,
      metadata: { name: input.name, environment: input.environment },
    });
    revalidatePath("/app/configuracoes");
    return { success: true, data: { id: client.id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function createApiKeyAction(input: {
  apiClientId: string;
  scopes: ApiScope[];
}): Promise<ActionResult<{ token: string; keyId: string }>> {
  try {
    const ctx = await requireApiAdmin();
    const client = await adminPrisma.apiClient.findFirst({
      where: { id: input.apiClientId, organizationId: ctx.organizationId },
    });
    if (!client) return { success: false, error: "Client não encontrado" };

    const invalid = input.scopes.filter((s) => !API_SCOPES.includes(s));
    if (invalid.length) return { success: false, error: "Escopos inválidos" };

    const { key, token } = await createApiKey({
      apiClientId: client.id,
      organizationId: ctx.organizationId,
      scopes: input.scopes,
      environment: client.environment,
    });

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "api.key.create",
      entityType: "ApiKey",
      entityId: key.id,
      metadata: { apiClientId: client.id, scopes: input.scopes },
    });

    revalidatePath("/app/configuracoes");
    return { success: true, data: { token, keyId: key.id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function revokeApiKeyAction(keyId: string): Promise<ActionResult> {
  try {
    const ctx = await requireApiAdmin();
    await revokeApiKey(keyId, ctx.organizationId);
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "api.key.revoke",
      entityType: "ApiKey",
      entityId: keyId,
    });
    revalidatePath("/app/configuracoes");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listApiRequestLogsAction(apiClientId?: string) {
  const ctx = await requireApiAdmin();
  return adminPrisma.apiRequestLog.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(apiClientId ? { apiClientId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createWebhookEndpointAction(input: {
  apiClientId: string;
  url: string;
  events: string[];
}): Promise<ActionResult<{ id: string; secret: string }>> {
  try {
    const ctx = await requireApiAdmin();
    const webhooksOk = await hasOrgFeature(ctx.organizationId, "webhooks");
    if (!webhooksOk) return { success: false, error: "Webhooks em plano ENTERPRISE" };

    const secret = randomBytes(32).toString("base64url");
    const ep = await adminPrisma.webhookEndpoint.create({
      data: {
        organizationId: ctx.organizationId,
        apiClientId: input.apiClientId,
        url: input.url,
        secret,
        events: input.events,
      },
    });
    revalidatePath("/app/configuracoes");
    return { success: true, data: { id: ep.id, secret } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listWebhookDeliveriesAction(endpointId: string) {
  const ctx = await requireApiAdmin();
  return adminPrisma.webhookDelivery.findMany({
    where: { organizationId: ctx.organizationId, webhookEndpointId: endpointId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function enableClinicalApiAccessAction(input: {
  apiClientId: string;
  justification: string;
}): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER"]);
    await adminPrisma.apiClient.updateMany({
      where: { id: input.apiClientId, organizationId: ctx.organizationId },
      data: {
        clinicalAccessEnabled: true,
        clinicalAccessJustification: input.justification,
        clinicalAccessEnabledAt: new Date(),
      },
    });
    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "api.clinical_access.enable",
      entityType: "ApiClient",
      entityId: input.apiClientId,
      metadata: { justification: input.justification },
    });
    revalidatePath("/app/configuracoes");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}
