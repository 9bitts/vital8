import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { adminPrisma } from "@/lib/db/admin-client";
import type { ApiClientEnvironment } from "@/generated/prisma/client";
import type { ApiScope } from "../lib/scopes";

export function generateKeyPrefix(environment: ApiClientEnvironment): string {
  const base = environment === "SANDBOX" ? "vk_test_" : "vk_live_";
  return base + randomBytes(12).toString("hex");
}

export function generateSecret(): string {
  return randomBytes(32).toString("base64url");
}

export async function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, 10);
}

export async function createApiClient(input: {
  organizationId: string;
  name: string;
  environment: ApiClientEnvironment;
}) {
  return adminPrisma.apiClient.create({ data: input });
}

export async function createApiKey(input: {
  apiClientId: string;
  organizationId: string;
  scopes: ApiScope[];
  environment: ApiClientEnvironment;
  expiresAt?: Date | null;
}) {
  const keyPrefix = generateKeyPrefix(input.environment);
  const secret = generateSecret();
  const secretHash = await hashSecret(secret);

  const key = await adminPrisma.apiKey.create({
    data: {
      apiClientId: input.apiClientId,
      organizationId: input.organizationId,
      keyPrefix,
      secretHash,
      scopes: input.scopes,
      expiresAt: input.expiresAt ?? null,
    },
  });

  return { key, token: `${keyPrefix}.${secret}` };
}

export async function revokeApiKey(keyId: string, organizationId: string) {
  return adminPrisma.apiKey.updateMany({
    where: { id: keyId, organizationId },
    data: { revokedAt: new Date() },
  });
}
