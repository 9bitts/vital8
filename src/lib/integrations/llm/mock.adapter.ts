import type { CompleteInput, CompleteResult, LlmAdapter, TranscribeInput, TranscribeResult } from "./types";

function hashSeed(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function detectIntent(text: string): string {
  const t = text.toLowerCase();
  if (/humano|atendente|falar com/.test(t)) return "humano";
  if (/cancel/.test(t)) return "cancelar";
  if (/remarc|mudar hor/.test(t)) return "remarcar";
  if (/confirm/.test(t)) return "confirmar";
  if (/preparo|jejum|orienta/.test(t)) return "duvida_preparo";
  if (/hor[aá]rio|funcionamento|abre/.test(t)) return "horario_funcionamento";
  if (/agend|marcar|consulta/.test(t)) return "agendar";
  return "duvida_geral";
}

export class MockLlmAdapter implements LlmAdapter {
  readonly name = "mock";

  async complete(input: CompleteInput): Promise<CompleteResult> {
    const last =
      [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const system = input.system ?? "";

    if (system.includes("INTENT_CLASSIFIER") || system.includes("classifique")) {
      const intent = detectIntent(last);
      return {
        text: JSON.stringify({ intent }),
        tokensUsed: 42,
        model: "mock-intent",
      };
    }

    if (system.includes("SOAP") || system.includes("estruture")) {
      return {
        text: JSON.stringify({
          subjective: "Queixa principal conforme relato do paciente.",
          objective: "Exame físico a completar pelo profissional.",
          assessment: "Hipótese diagnóstica preliminar — revisar.",
          plan: "Conduta sugerida — confirmar antes de registrar.",
        }),
        tokensUsed: 120,
        model: "mock-soap",
      };
    }

    if (system.includes("CID") || system.includes("cid-10")) {
      return {
        text: JSON.stringify([
          { code: "J06.9", label: "Infecção aguda das vias aéreas superiores" },
          { code: "R51", label: "Cefaleia" },
          { code: "M54.5", label: "Dor lombar baixa" },
        ]),
        tokensUsed: 80,
        model: "mock-cid",
      };
    }

    if (system.includes("RESUMO") || system.includes("histórico")) {
      return {
        text:
          "**Resumo gerado por IA (não registrado no prontuário)**\n\n" +
          "- Queixas recorrentes mencionadas em atendimentos anteriores.\n" +
          "- Medicamentos em uso conforme histórico.\n" +
          "- Alertas de alergias/condições crônicas quando presentes.",
        tokensUsed: 150,
        model: "mock-summary",
      };
    }

    if (system.includes("INSIGHT") || system.includes("dashboard")) {
      const seed = hashSeed(last) % 3;
      const insights = [
        "Taxa de no-show de segunda-feira está acima da média semanal — considere régua reforçada.",
        "Receita de convênios cresceu vs. período anterior — verifique conciliação TISS.",
        "Ocupação da agenda da manhã está abaixo de 60% — avalie campanhas de retorno.",
      ];
      return {
        text: JSON.stringify({ insights: [insights[seed], insights[(seed + 1) % 3]] }),
        tokensUsed: 90,
        model: "mock-insights",
      };
    }

    if (system.includes("GLOSA") || system.includes("recurso")) {
      return {
        text:
          "Prezados,\n\nSolicitamos revisão da glosa aplicada, conforme documentação anexa e " +
          "compatibilidade do procedimento com a cobertura contratual. [Rascunho IA — revisar]",
        tokensUsed: 100,
        model: "mock-glosa",
      };
    }

    if (system.includes("COBRAN") || system.includes("cobrança")) {
      return {
        text:
          "Olá! Identificamos um débito pendente em sua conta. Podemos ajudá-lo(a) a regularizar " +
          "com condições facilitadas. Entre em contato conosco. [Template aprovado + personalização IA]",
        tokensUsed: 70,
        model: "mock-collection",
      };
    }

    if (system.includes("SMART_SEARCH") || system.includes("interpretar")) {
      const t = last.toLowerCase();
      if (/agenda|consulta/.test(t) && /amanh|hoje/.test(t)) {
        return {
          text: JSON.stringify({ route: "/app/agenda", filters: { date: "tomorrow" } }),
          tokensUsed: 30,
          model: "mock-search",
        };
      }
      if (/venc|receb|inadimpl/.test(t)) {
        return {
          text: JSON.stringify({ route: "/app/financeiro/receber", filters: { status: "overdue" } }),
          tokensUsed: 30,
          model: "mock-search",
        };
      }
      return {
        text: JSON.stringify({ route: null, query: last }),
        tokensUsed: 20,
        model: "mock-search",
      };
    }

    if (system.includes("SECRETARY") || system.includes("secretária")) {
      const intent = detectIntent(last);
      if (intent === "humano") {
        return {
          text: "Entendi. Vou transferir você para nossa equipe de recepção. Aguarde um momento.",
          tokensUsed: 40,
          model: "mock-secretary",
        };
      }
      if (intent === "agendar") {
        return {
          text: "Posso ajudar com o agendamento. Temos horários disponíveis conforme consulta ao sistema.",
          tokensUsed: 50,
          model: "mock-secretary",
        };
      }
      return {
        text: "Como posso ajudar? Posso agendar, remarcar, cancelar ou confirmar consultas.",
        tokensUsed: 35,
        model: "mock-secretary",
      };
    }

    return {
      text: `[mock] Resposta determinística (${hashSeed(last) % 1000})`,
      tokensUsed: 25,
      model: "mock-default",
    };
  }

  async *stream(input: CompleteInput): AsyncIterable<string> {
    const result = await this.complete(input);
    yield result.text;
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const seed = hashSeed(input.audioBase64.slice(0, 64));
    return {
      text: `Paciente relata dor há ${seed % 7 + 1} dias, sem febre. Mock de transcrição.`,
      tokensUsed: 60,
    };
  }
}
