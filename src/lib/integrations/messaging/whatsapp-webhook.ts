import crypto from "crypto";

function getAppSecret(): string | undefined {
  return (
    process.env.WHATSAPP_APP_SECRET?.trim() ||
    process.env.WHATSAPP_WEBHOOK_SECRET?.trim() ||
    undefined
  );
}

/** Validates X-Hub-Signature-256 from Meta (HMAC-SHA256 of raw body with app secret). */
export function verifyWhatsAppWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = getAppSecret();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = signatureHeader.slice("sha256=".length);
  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return computed === expected;
  }
}
