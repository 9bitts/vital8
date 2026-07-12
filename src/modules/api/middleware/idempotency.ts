import { adminPrisma } from "@/lib/db/admin-client";
import { NextResponse } from "next/server";
import type { ApiContext } from "../middleware/authenticate";

const TTL_MS = 24 * 60 * 60 * 1000;

export async function checkIdempotency(
  ctx: ApiContext,
  method: string,
  path: string,
  idempotencyKey: string | null,
): Promise<NextResponse | null> {
  if (method !== "POST" || !idempotencyKey) return null;

  const existing = await adminPrisma.apiIdempotencyRecord.findUnique({
    where: {
      apiKeyId_idempotencyKey: { apiKeyId: ctx.apiKeyId, idempotencyKey },
    },
  });

  if (existing && existing.expiresAt > new Date()) {
    return NextResponse.json(existing.responseBody, { status: existing.statusCode });
  }
  return null;
}

export async function storeIdempotency(
  ctx: ApiContext,
  method: string,
  path: string,
  idempotencyKey: string,
  statusCode: number,
  body: unknown,
) {
  const expiresAt = new Date(Date.now() + TTL_MS);
  await adminPrisma.apiIdempotencyRecord.upsert({
    where: {
      apiKeyId_idempotencyKey: { apiKeyId: ctx.apiKeyId, idempotencyKey },
    },
    create: {
      organizationId: ctx.organizationId,
      apiClientId: ctx.apiClientId,
      apiKeyId: ctx.apiKeyId,
      idempotencyKey,
      method,
      path,
      statusCode,
      responseBody: body as object,
      expiresAt,
    },
    update: { statusCode, responseBody: body as object, expiresAt },
  });
}

export function requireIdempotencyKey(header: string | null): string {
  if (!header?.trim()) {
    throw new Error("Idempotency-Key obrigatório em POST");
  }
  return header.trim();
}
