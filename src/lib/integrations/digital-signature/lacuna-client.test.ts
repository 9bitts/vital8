import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createSignatureSession,
  getSignedLocation,
  isLacunaConfigured,
} from "./lacuna-client";

describe("lacuna-client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.LACUNA_API_KEY = "app|test-key";
  });

  it("detecta configuração", () => {
    expect(isLacunaConfigured()).toBe(true);
  });

  it("cria signature session", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "sess_1",
        redirectUrl: "https://lacuna.test/sign",
      }),
    });

    const result = await createSignatureSession({
      pdfBytes: Buffer.from("%PDF"),
      fileName: "test.pdf",
      returnUrl: "http://localhost:3000/api/digital-sign/callback",
    });

    expect(result.sessionId).toBe("sess_1");
    expect(result.redirectUrl).toContain("lacuna");
  });

  it("extrai location do documento assinado", () => {
    const loc = getSignedLocation({
      id: "s1",
      status: "Completed",
      documents: [{ signedFile: { location: "/files/signed.pdf" } }],
    });
    expect(loc).toBe("/files/signed.pdf");
  });
});
