import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import { verifyWhatsAppWebhookSignature } from "./whatsapp-webhook";

describe("verifyWhatsAppWebhookSignature", () => {
  beforeEach(() => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "test-secret");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("aceita assinatura HMAC válida", () => {
    const body = '{"entry":[]}';
    const sig =
      "sha256=" +
      crypto.createHmac("sha256", "test-secret").update(body).digest("hex");

    expect(verifyWhatsAppWebhookSignature(body, sig)).toBe(true);
  });

  it("rejeita assinatura inválida", () => {
    expect(
      verifyWhatsAppWebhookSignature('{"entry":[]}', "sha256=deadbeef"),
    ).toBe(false);
  });

  it("permite sem secret fora de produção", () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "");
    vi.stubEnv("WHATSAPP_WEBHOOK_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");

    expect(verifyWhatsAppWebhookSignature("{}", null)).toBe(true);
  });
});
