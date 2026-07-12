import type { RndsAdapter, RndsAdapterConfig, RndsSubmitResult, RndsTokenResponse } from "./types";

/** Cache em memória por credencial — renovação automática a cada 15 min. */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function cacheKey(config: RndsAdapterConfig): string {
  return `${config.environment}:${config.requesterId}`;
}

export function clearRndsTokenCacheForTests() {
  tokenCache.clear();
}

export async function getRndsToken(
  adapter: RndsAdapter,
  config: RndsAdapterConfig,
  forceRefresh = false,
): Promise<string> {
  const key = cacheKey(config);
  const cached = tokenCache.get(key);
  const now = Date.now();

  if (!forceRefresh && cached && cached.expiresAt > now + 30_000) {
    return cached.token;
  }

  const response = await adapter.authenticate(config);
  tokenCache.set(key, {
    token: response.access_token,
    expiresAt: now + (response.expires_in ?? 900) * 1000,
  });
  return response.access_token;
}

export function simulateTokenExpiry(config: RndsAdapterConfig): void {
  const key = cacheKey(config);
  const cached = tokenCache.get(key);
  if (cached) {
    tokenCache.set(key, { ...cached, expiresAt: Date.now() - 1000 });
  }
}

export type { RndsTokenResponse, RndsSubmitResult };
