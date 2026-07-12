import type {
  CompleteInput,
  CompleteResult,
  LlmAdapter,
  TranscribeInput,
  TranscribeResult,
} from "./types";

/** Routes complete and transcribe to different providers (Doctor8 pattern). */
export class CompositeLlmAdapter implements LlmAdapter {
  readonly name: string;

  constructor(
    private completeProvider: LlmAdapter,
    private transcribeProvider: Pick<LlmAdapter, "name" | "transcribe">,
  ) {
    const completeName = completeProvider.name;
    const transcribeName = transcribeProvider.name;
    if (completeName === transcribeName) {
      this.name = completeName;
    } else if (completeName === "mock") {
      this.name = transcribeName;
    } else if (transcribeName === "mock") {
      this.name = completeName;
    } else {
      this.name = `${completeName}+${transcribeName}`;
    }
  }

  async complete(input: CompleteInput): Promise<CompleteResult> {
    return this.completeProvider.complete(input);
  }

  stream(input: CompleteInput): AsyncIterable<string> {
    if (this.completeProvider.stream) {
      return this.completeProvider.stream(input);
    }
    const provider = this.completeProvider;
    return (async function* () {
      const result = await provider.complete(input);
      yield result.text;
    })();
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    return this.transcribeProvider.transcribe(input);
  }
}
