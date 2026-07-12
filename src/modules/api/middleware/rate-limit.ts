import { adminPrisma } from "@/lib/db/admin-client";
import { getSubscriptionContext } from "@/lib/features/subscription.service";
import { RATE_LIMITS_BY_PLAN } from "../lib/scopes";
import { rateLimited } from "../lib/errors";

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export async function checkRateLimit(apiKeyId: string, organizationId: string) {
  const sub = await getSubscriptionContext(organizationId);
  const limit = RATE_LIMITS_BY_PLAN[sub.subscriptionPlan] ?? 60;
  const now = Date.now();
  const key = apiKeyId;
  let w = windows.get(key);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + 60_000 };
    windows.set(key, w);
  }
  w.count += 1;
  if (w.count > limit) {
    const retryAfter = Math.ceil((w.resetAt - now) / 1000);
    throw rateLimited(retryAfter);
  }
  return {
    limit,
    remaining: Math.max(0, limit - w.count),
    resetAt: w.resetAt,
  };
}

export function rateLimitHeaders(info: { limit: number; remaining: number; resetAt: number }) {
  return {
    "X-RateLimit-Limit": String(info.limit),
    "X-RateLimit-Remaining": String(info.remaining),
    "X-RateLimit-Reset": String(Math.floor(info.resetAt / 1000)),
  };
}

export function resetRateLimitForTests(apiKeyId?: string) {
  if (apiKeyId) windows.delete(apiKeyId);
  else windows.clear();
}

export async function logApiRequest(input: {
  organizationId: string;
  apiClientId: string;
  apiKeyId: string;
  method: string;
  route: string;
  statusCode: number;
  latencyMs: number;
  ipAddress: string | null;
}) {
  return adminPrisma.apiRequestLog.create({ data: input });
}
