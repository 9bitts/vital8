import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { OpenAiWhisperAdapter } from "./openai.adapter";

describe("OpenAiWhisperAdapter", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.unstubAllEnvs();
    delete process.env.E2E_MOCK_OPENAI;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("transcribes audio via Whisper API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ text: "Paciente relata dor há dois dias." }),
    });

    const adapter = new OpenAiWhisperAdapter("sk-test");
    const audioBase64 = Buffer.from("fake-audio-bytes").toString("base64");
    const result = await adapter.transcribe({
      audioBase64,
      mimeType: "audio/webm",
      language: "pt-BR",
    });

    expect(result.text).toContain("dor");
    expect(result.tokensUsed).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer sk-test" },
      }),
    );
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("model")).toBe("whisper-1");
    expect(body.get("language")).toBe("pt");
  });

  it("throws on empty transcription", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ text: "   " }),
    });

    const adapter = new OpenAiWhisperAdapter("sk-test");
    await expect(
      adapter.transcribe({
        audioBase64: Buffer.from("x").toString("base64"),
      }),
    ).rejects.toThrow(/vazia/i);
  });

  it("uses E2E mock when enabled", async () => {
    process.env.E2E_MOCK_OPENAI = "1";
    const adapter = new OpenAiWhisperAdapter("sk-test");
    const result = await adapter.transcribe({
      audioBase64: Buffer.from("x").toString("base64"),
    });
    expect(result.text).toContain("Mock E2E");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
