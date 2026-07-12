import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcrypt";
import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";
import type { ApiScope } from "../lib/scopes";
import { DEMO_ORG_SLUG, hasScope } from "../lib/scopes";
import { ApiError, unauthorized, insufficientScope } from "../lib/errors";

export type ApiContext = {
  organizationId: string;
  apiClientId: string;
  apiKeyId: string;
  clientName: string;
  scopes: string[];
  environment: "SANDBOX" | "PRODUCTION";
  clinicalAccessEnabled: boolean;
  db: ReturnType<typeof createTenantClient>;
};

function parseBearerToken(header: string | null): { keyPrefix: string; secret: string } | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  return { keyPrefix: token.slice(0, dot), secret: token.slice(dot + 1) };
}

export function verifyHmacSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;
  const match = signatureHeader.match(/t=(\d+),v1=([a-f0-9]+)/i);
  if (!match) return false;
  const [, ts, sig] = match;
  const payload = `${ts}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig!, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function authenticateApiRequest(
  request: Request,
  requiredScopes: ApiScope[] = [],
  rawBody = "",
): Promise<ApiContext> {
  const parsed = parseBearerToken(request.headers.get("authorization"));
  if (!parsed) throw unauthorized();

  const apiKey = await adminPrisma.apiKey.findUnique({
    where: { keyPrefix: parsed.keyPrefix },
    include: { apiClient: { include: { organization: true } } },
  });

  if (!apiKey || apiKey.revokedAt) throw unauthorized();
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) throw unauthorized("Key expirada");

  const valid = await bcrypt.compare(parsed.secret, apiKey.secretHash);
  if (!valid) throw unauthorized();

  const client = apiKey.apiClient;
  if (!client.isActive || !client.organization.isActive) {
    throw unauthorized("Client ou organização inativa");
  }

  if (client.environment === "SANDBOX" && client.organization.slug !== DEMO_ORG_SLUG) {
    throw unauthorized("Keys SANDBOX só operam na organização demo");
  }

  const sigHeader = request.headers.get("x-vital8-signature");
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  const hmacRequired =
    isWrite &&
    (process.env.NODE_ENV === "production" || process.env.VITAL8_REQUIRE_HMAC === "true");

  if (hmacRequired) {
    if (!sigHeader || !verifyHmacSignature(parsed.secret, rawBody, sigHeader)) {
      throw unauthorized(
        sigHeader ? "Assinatura HMAC inválida" : "Header X-Vital8-Signature obrigatório",
      );
    }
  } else if (isWrite && sigHeader) {
    if (!verifyHmacSignature(parsed.secret, rawBody, sigHeader)) {
      throw unauthorized("Assinatura HMAC inválida");
    }
  }

  for (const scope of requiredScopes) {
    if (!hasScope(apiKey.scopes, scope)) throw insufficientScope(scope);
  }

  if (requiredScopes.includes("encounters:read") && !client.clinicalAccessEnabled) {
    throw new ApiError(
      "FORBIDDEN",
      "Acesso clínico requer habilitação pelo OWNER com justificativa LGPD",
      403,
    );
  }

  void adminPrisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    organizationId: client.organizationId,
    apiClientId: client.id,
    apiKeyId: apiKey.id,
    clientName: client.name,
    scopes: apiKey.scopes,
    environment: client.environment,
    clinicalAccessEnabled: client.clinicalAccessEnabled,
    db: createTenantClient(client.organizationId),
  };
}

export async function assertApiFeature(organizationId: string) {
  const { hasOrgFeature } = await import("@/lib/features/subscription.service");
  const ok = await hasOrgFeature(organizationId, "public_api");
  if (!ok) {
    throw new ApiError("FEATURE_DISABLED", "API disponível em planos PRO e ENTERPRISE", 403);
  }
}
