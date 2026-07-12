import type { NextRequest } from "next/server";
import { createAuditLog } from "@/modules/core/services/audit.service";
import { authenticateApiRequest, assertApiFeature } from "../middleware/authenticate";
import {
  checkRateLimit,
  logApiRequest,
  rateLimitHeaders,
} from "../middleware/rate-limit";
import { apiErrorResponse } from "./response";
import type { ApiScope } from "./scopes";
import type { ApiContext } from "../middleware/authenticate";
import { ApiError, validationError } from "./errors";
import { checkIdempotency, storeIdempotency } from "../middleware/idempotency";

type Handler = (
  req: NextRequest,
  ctx: ApiContext,
  params?: Record<string, string>,
) => Promise<Response>;

type RouteOptions = {
  scopes?: ApiScope[];
  requireIdempotency?: boolean;
};

export function withApiRoute(options: RouteOptions, handler: Handler) {
  return async (req: NextRequest, segment?: { params?: Promise<Record<string, string>> }) => {
    const start = Date.now();
    const route = new URL(req.url).pathname;
    let statusCode = 500;
    let rateHeaders: Record<string, string> = {};
    let apiCtx: ApiContext | null = null;

    try {
      const rawBody =
        req.method !== "GET" && req.method !== "HEAD" ? await req.clone().text() : "";

      apiCtx = await authenticateApiRequest(req, options.scopes ?? [], rawBody);
      await assertApiFeature(apiCtx.organizationId);

      const rl = await checkRateLimit(apiCtx.apiKeyId, apiCtx.organizationId);
      rateHeaders = rateLimitHeaders(rl);

      if (options.requireIdempotency && req.method === "POST") {
        const idemKey = req.headers.get("idempotency-key");
        if (!idemKey?.trim()) throw validationError("Header Idempotency-Key obrigatório");
        const cached = await checkIdempotency(apiCtx, req.method, route, idemKey.trim());
        if (cached) {
          statusCode = cached.status;
          for (const [k, v] of Object.entries(rateHeaders)) cached.headers.set(k, v);
          return cached;
        }
      }

      const params = segment?.params ? await segment.params : undefined;
      const response = await handler(req, apiCtx, params);
      statusCode = response.status;

      if (
        options.requireIdempotency &&
        req.method === "POST" &&
        statusCode < 500 &&
        req.headers.get("idempotency-key")
      ) {
        const idemKey = req.headers.get("idempotency-key")!.trim();
        const body = await response.clone().json();
        await storeIdempotency(apiCtx, req.method, route, idemKey, statusCode, body);
      }

      const headers = new Headers(response.headers);
      for (const [k, v] of Object.entries(rateHeaders)) headers.set(k, v);
      return new Response(response.body, { status: response.status, headers });
    } catch (err) {
      if (err instanceof ApiError) statusCode = err.status;
      const res = apiErrorResponse(err, rateHeaders);
      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        const retry = (err.details[0] as { retryAfter?: number })?.retryAfter ?? 60;
        res.headers.set("Retry-After", String(retry));
      }
      return res;
    } finally {
      if (apiCtx) {
        await logApiRequest({
          organizationId: apiCtx.organizationId,
          apiClientId: apiCtx.apiClientId,
          apiKeyId: apiCtx.apiKeyId,
          method: req.method,
          route,
          statusCode,
          latencyMs: Date.now() - start,
          ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        }).catch(() => undefined);
      }
    }
  };
}

export async function auditApiWrite(
  ctx: ApiContext,
  action: string,
  entityType: string,
  entityId: string,
  ip: string | null,
) {
  await createAuditLog({
    organizationId: ctx.organizationId,
    userId: null,
    action,
    entityType,
    entityId,
    metadata: { via: `api:${ctx.clientName}` },
    ipAddress: ip,
  });
}
