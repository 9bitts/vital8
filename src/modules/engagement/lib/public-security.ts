import { createHmac, randomBytes } from "crypto";

const FILE_TOKEN_TTL_MS = 15 * 60 * 1000;

function getSigningKey(): string {
  const key = process.env.AUTH_SECRET;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET obrigatório em produção");
    }
    return "dev-insecure-secret-only-local";
  }
  return key;
}

export function createSignedFileToken(payload: {
  organizationId: string;
  resourceType: string;
  resourceId: string;
  patientId: string;
}): string {
  const exp = Date.now() + FILE_TOKEN_TTL_MS;
  const body = JSON.stringify({ ...payload, exp });
  const sig = createHmac("sha256", getSigningKey()).update(body).digest("hex");
  return Buffer.from(JSON.stringify({ body, sig })).toString("base64url");
}

export function verifySignedFileToken(token: string): {
  organizationId: string;
  resourceType: string;
  resourceId: string;
  patientId: string;
} | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(token, "base64url").toString("utf8"),
    ) as { body: string; sig: string };
    const expected = createHmac("sha256", getSigningKey())
      .update(parsed.body)
      .digest("hex");
    if (expected !== parsed.sig) return null;
    const data = JSON.parse(parsed.body) as {
      organizationId: string;
      resourceType: string;
      resourceId: string;
      patientId: string;
      exp: number;
    };
    if (data.exp < Date.now()) return null;
    return {
      organizationId: data.organizationId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      patientId: data.patientId,
    };
  } catch {
    return null;
  }
}

export function generatePublicToken(): string {
  return randomBytes(24).toString("hex");
}

export const PUBLIC_SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(self)",
};
