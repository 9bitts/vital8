import { MockLlmAdapter } from "./mock.adapter";
import { AnthropicLlmAdapter } from "./anthropic.adapter";
import type { LlmAdapter } from "./types";

let adapter: LlmAdapter | null = null;

export function getLlmAdapter(): LlmAdapter {
  if (!adapter) {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (key) {
      adapter = new AnthropicLlmAdapter(key, process.env.ANTHROPIC_MODEL);
    } else {
      adapter = new MockLlmAdapter();
    }
  }
  return adapter;
}

/** Reset for tests */
export function resetLlmAdapter() {
  adapter = null;
}

export type { LlmAdapter, CompleteInput, CompleteResult, TranscribeInput, TranscribeResult } from "./types";
