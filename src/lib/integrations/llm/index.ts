import { MockLlmAdapter } from "./mock.adapter";
import { AnthropicLlmAdapter } from "./anthropic.adapter";
import { CompositeLlmAdapter } from "./composite.adapter";
import { OpenAiWhisperAdapter } from "./openai.adapter";
import type { LlmAdapter } from "./types";

let adapter: LlmAdapter | null = null;

function buildAdapter(): LlmAdapter {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const mock = new MockLlmAdapter();

  const completeProvider = anthropicKey
    ? new AnthropicLlmAdapter(anthropicKey, process.env.ANTHROPIC_MODEL)
    : mock;

  const transcribeProvider = openaiKey
    ? new OpenAiWhisperAdapter(openaiKey, process.env.OPENAI_WHISPER_MODEL)
    : mock;

  if (
    completeProvider.name === transcribeProvider.name &&
    completeProvider.name === "mock"
  ) {
    return mock;
  }

  if (completeProvider.name === transcribeProvider.name) {
    return completeProvider;
  }

  return new CompositeLlmAdapter(completeProvider, transcribeProvider);
}

export function getLlmAdapter(): LlmAdapter {
  if (!adapter) {
    adapter = buildAdapter();
  }
  return adapter;
}

/** Reset for tests */
export function resetLlmAdapter() {
  adapter = null;
}

export { getLlmReadiness } from "./llm-readiness";
export type { LlmReadiness } from "./llm-readiness";
export type {
  LlmAdapter,
  CompleteInput,
  CompleteResult,
  TranscribeInput,
  TranscribeResult,
} from "./types";
