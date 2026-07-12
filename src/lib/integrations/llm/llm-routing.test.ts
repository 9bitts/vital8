import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getLlmAdapter, resetLlmAdapter } from "./index";
import { getLlmReadiness } from "./llm-readiness";

describe("getLlmAdapter routing", () => {
  const prevAnthropic = process.env.ANTHROPIC_API_KEY;
  const prevOpenai = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    resetLlmAdapter();
  });

  afterEach(() => {
    resetLlmAdapter();
    if (prevAnthropic) process.env.ANTHROPIC_API_KEY = prevAnthropic;
    else delete process.env.ANTHROPIC_API_KEY;
    if (prevOpenai) process.env.OPENAI_API_KEY = prevOpenai;
    else delete process.env.OPENAI_API_KEY;
  });

  it("returns mock when no keys", () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(getLlmAdapter().name).toBe("mock");
  });

  it("returns composite when both keys present", () => {
    process.env.ANTHROPIC_API_KEY = "ant";
    process.env.OPENAI_API_KEY = "oai";
    expect(getLlmAdapter().name).toBe("anthropic+openai-whisper");
  });

  it("readiness reports partial stack", () => {
    process.env.ANTHROPIC_API_KEY = "ant";
    delete process.env.OPENAI_API_KEY;
    const r = getLlmReadiness();
    expect(r.anthropicConfigured).toBe(true);
    expect(r.openaiConfigured).toBe(false);
    expect(r.completeProvider).toBe("anthropic");
    expect(r.transcribeProvider).toBe("mock");
    expect(r.productionReady).toBe(false);
  });
});
