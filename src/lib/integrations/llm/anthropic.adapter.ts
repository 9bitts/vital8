import type { CompleteInput, CompleteResult, LlmAdapter, TranscribeInput, TranscribeResult } from "./types";

export class AnthropicLlmAdapter implements LlmAdapter {
  readonly name = "anthropic";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "claude-sonnet-4-20250514") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(input: CompleteInput): Promise<CompleteResult> {
    const messages = input.messages.filter((m) => m.role !== "system");
    const system = input.system ?? input.messages.find((m) => m.role === "system")?.content;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: input.maxTokens ?? 1024,
        temperature: input.temperature ?? 0.3,
        system,
        messages: messages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      content: { type: string; text: string }[];
      usage: { input_tokens: number; output_tokens: number };
      model: string;
    };

    const text = data.content.find((c) => c.type === "text")?.text ?? "";
    return {
      text,
      tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      model: data.model ?? this.model,
    };
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    void input;
    throw new Error(
      "Transcrição via Anthropic não suportada — configure OPENAI_API_KEY para Whisper",
    );
  }
}
