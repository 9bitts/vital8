import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { assertSafeOutboundUrl, isSafeOutboundUrl } from "./url-validation";
import { checkLoginRateLimit } from "./login-rate-limit";
import { assertCronAuthorized } from "./cron-auth";
import { resetAllRateLimitsForTests } from "@/modules/engagement/lib/rate-limit";
import { ConsoleMessagingAdapter } from "@/lib/integrations/messaging/console.adapter";
import { verifyHmacSignature } from "@/modules/api/middleware/authenticate";

describe("SSRF — URL de webhook", () => {
  it("bloqueia localhost e IP privado", () => {
    expect(() => assertSafeOutboundUrl("http://localhost/hook")).toThrow(/bloqueado/i);
    expect(() => assertSafeOutboundUrl("http://127.0.0.1/hook")).toThrow(/bloqueado/i);
    expect(() => assertSafeOutboundUrl("http://192.168.1.1/hook")).toThrow(/privado/i);
    expect(() => assertSafeOutboundUrl("http://169.254.169.254/latest/meta-data")).toThrow(/bloqueado/i);
  });

  it("aceita URL pública HTTPS", () => {
    expect(isSafeOutboundUrl("https://api.example.com/webhooks/vital8")).toBe(true);
  });
});

describe("rate limit de login", () => {
  beforeEach(() => {
    resetAllRateLimitsForTests();
  });

  it("bloqueia após tentativas excessivas por e-mail", () => {
    const ip = "10.0.0.1";
    for (let i = 0; i < 10; i++) {
      expect(checkLoginRateLimit("user@test.com", ip).allowed).toBe(true);
    }
    expect(checkLoginRateLimit("user@test.com", ip).allowed).toBe(false);
  });
});

describe("cron jobs — autenticação", () => {
  it("rejeita em produção sem CRON_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("JOBS_SECRET", "");
    const req = new Request("http://local/api/jobs/process");
    expect(assertCronAuthorized(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("aceita bearer válido", () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const req = new Request("http://local/api/jobs/process", {
      headers: { authorization: "Bearer test-secret" },
    });
    expect(assertCronAuthorized(req)).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("PHI em adapter de mensagens (dev)", () => {
  it("não loga corpo nem destino em produção", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");
    const adapter = new ConsoleMessagingAdapter();
    await adapter.send({
      channel: "SMS",
      to: "11999998888",
      body: "Paciente João — diagnóstico J06",
    });
    const output = JSON.stringify(logSpy.mock.calls);
    expect(output).not.toMatch(/11999998888/);
    expect(output).not.toMatch(/diagnóstico/i);
    vi.unstubAllEnvs();
    logSpy.mockRestore();
  });
});

describe("notificações — markRead exige organizationId", () => {
  it("assinatura inclui organizationId", async () => {
    const { markRead } = await import("@/modules/analytics/services/notification.service");
    expect(markRead.length).toBe(3);
  });
});

describe("HMAC API — produção", () => {
  it("verifyHmacSignature rejeita header ausente", () => {
    expect(verifyHmacSignature("secret", "{}", null)).toBe(false);
  });

  it("verifyHmacSignature aceita assinatura válida", () => {
    const body = '{"a":1}';
    const ts = "1700000000";
    const sig = createHmac("sha256", "secret").update(`${ts}.${body}`).digest("hex");
    expect(verifyHmacSignature("secret", body, `t=${ts},v1=${sig}`)).toBe(true);
  });
});
