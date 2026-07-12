export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CompleteInput = {
  messages: LlmMessage[];
  system?: string;
  temperature?: number;
  maxTokens?: number;
};

export type CompleteResult = {
  text: string;
  tokensUsed: number;
  model: string;
};

export type TranscribeInput = {
  audioBase64: string;
  mimeType?: string;
  language?: string;
};

export type TranscribeResult = {
  text: string;
  tokensUsed: number;
};

export interface LlmAdapter {
  readonly name: string;
  complete(input: CompleteInput): Promise<CompleteResult>;
  stream?(input: CompleteInput): AsyncIterable<string>;
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
}
