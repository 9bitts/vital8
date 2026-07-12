import { describe, expect, it, vi, beforeEach } from "vitest";
import { AnthropicLlmAdapter } from "./anthropic.adapter";

describe("AnthropicLlmAdapter", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("completes messages via Anthropic API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: '{"intent":"agendar"}' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: "claude-sonnet-4-20250514",
      }),
    });

    const adapter = new AnthropicLlmAdapter("ant-key");
    const result = await adapter.complete({
      system: "INTENT_CLASSIFIER",
      messages: [{ role: "user", content: "quero agendar" }],
    });

    expect(result.text).toContain("agendar");
    expect(result.tokensUsed).toBe(15);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "ant-key",
        }),
      }),
    );
  });
});
