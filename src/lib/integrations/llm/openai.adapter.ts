import type { TranscribeInput, TranscribeResult } from "./types";

const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";

function extensionFromMime(mimeType?: string): string {
  const mime = (mimeType ?? "audio/webm").toLowerCase();
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function languageCode(language?: string): string | undefined {
  if (!language) return "pt";
  const normalized = language.toLowerCase();
  if (normalized.startsWith("pt")) return "pt";
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("es")) return "es";
  return undefined;
}

function estimateTokens(text: string, audioBase64: string): number {
  const textTokens = Math.ceil(text.length / 4);
  const audioBytes = Math.ceil((audioBase64.length * 3) / 4);
  const durationEstimate = Math.max(1, Math.ceil(audioBytes / 16_000));
  return Math.max(textTokens, durationEstimate * 10);
}

export class OpenAiWhisperAdapter {
  readonly name = "openai-whisper";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "whisper-1") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    if (process.env.E2E_MOCK_OPENAI === "1") {
      return {
        text: "Paciente relata sintomas há três dias. Mock E2E de transcrição.",
        tokensUsed: 40,
      };
    }

    const buffer = Buffer.from(input.audioBase64, "base64");
    if (buffer.length === 0) {
      throw new Error("Áudio vazio");
    }

    const ext = extensionFromMime(input.mimeType);
    const file = new File(
      [new Uint8Array(buffer)],
      `consult.${ext}`,
      { type: input.mimeType || `audio/${ext}` },
    );

    const form = new FormData();
    form.append("file", file);
    form.append("model", this.model);
    const lang = languageCode(input.language);
    if (lang) form.append("language", lang);

    const res = await fetch(OPENAI_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[OPENAI WHISPER]", err);
      throw new Error(`OpenAI Whisper error: ${res.status}`);
    }

    const data = (await res.json()) as { text?: string };
    const text = typeof data.text === "string" ? data.text.trim() : "";
    if (!text) throw new Error("Transcrição vazia");

    return {
      text,
      tokensUsed: estimateTokens(text, input.audioBase64),
    };
  }
}
