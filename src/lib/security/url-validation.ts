/**
 * Valida URLs de webhook/integração — bloqueia SSRF (localhost, IP privado, metadata).
 */
const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
]);

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function assertSafeOutboundUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL inválida");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Protocolo não permitido (apenas http/https)");
  }

  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("Webhooks em produção exigem HTTPS");
  }

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    throw new Error("Host bloqueado por política de segurança");
  }
  if (host.endsWith(".internal") || host.endsWith(".local")) {
    throw new Error("Host interno bloqueado");
  }
  if (isPrivateIpv4(host)) {
    throw new Error("IP privado bloqueado");
  }

  return parsed;
}

export function isSafeOutboundUrl(rawUrl: string): boolean {
  try {
    assertSafeOutboundUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}
