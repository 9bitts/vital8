import { aiComplete } from "./llm-gateway.service";

export async function draftGlosaAppeal(
  organizationId: string,
  userId: string,
  context: {
    reasonCode: string;
    reasonDescription: string;
    glosedAmountCents: number;
    guideNumber: string;
    procedureDescription?: string;
  },
) {
  return aiComplete({
    organizationId,
    userId,
    resource: "GLOSA_DRAFT",
    system: "GLOSA: rascunho de justificativa de recurso TISS — revisão obrigatória do faturista",
    userMessage: "Gerar rascunho de recurso",
    context,
  });
}
