export type LlmReadiness = {
  configured: boolean;
  anthropicConfigured: boolean;
  openaiConfigured: boolean;
  completeProvider: string;
  transcribeProvider: string;
  productionReady: boolean;
  note: string;
};

export function getLlmReadiness(): LlmReadiness {
  const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const configured = anthropicConfigured || openaiConfigured;

  const completeProvider = anthropicConfigured ? "anthropic" : "mock";
  const transcribeProvider = openaiConfigured ? "openai-whisper" : "mock";
  const productionReady = anthropicConfigured && openaiConfigured;

  let note: string;
  if (!configured) {
    note =
      "IA em modo mock — respostas determinísticas até definir ANTHROPIC_API_KEY e/ou OPENAI_API_KEY.";
  } else if (productionReady) {
    note =
      "Stack completo: Anthropic (texto/SOAP/CID) + OpenAI Whisper (transcrição do Scribe).";
  } else if (anthropicConfigured && !openaiConfigured) {
    note =
      "Anthropic ativo para texto. Adicione OPENAI_API_KEY para transcrição real do Scribe.";
  } else {
    note =
      "OpenAI Whisper ativo para transcrição. Adicione ANTHROPIC_API_KEY para copiloto/secretária em produção.";
  }

  return {
    configured,
    anthropicConfigured,
    openaiConfigured,
    completeProvider,
    transcribeProvider,
    productionReady,
    note,
  };
}
