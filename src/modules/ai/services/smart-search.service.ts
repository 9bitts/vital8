import { aiComplete } from "./llm-gateway.service";

export type SmartSearchResult = {
  route: string | null;
  label?: string;
  filters?: Record<string, string>;
  literalQuery?: string;
};

const ROUTES: { pattern: RegExp; route: string; label: string; filters?: Record<string, string> }[] = [
  { pattern: /agenda|consulta.*amanh/i, route: "/app/agenda", label: "Agenda de amanhã", filters: { date: "tomorrow" } },
  { pattern: /recep/i, route: "/app/recepcao", label: "Recepção" },
  { pattern: /venc|inadimpl|receber/i, route: "/app/financeiro/receber", label: "Contas a receber", filters: { status: "overdue" } },
  { pattern: /glosa|faturamento/i, route: "/app/faturamento/glosas", label: "Glosas" },
  { pattern: /paciente/i, route: "/app/pacientes", label: "Pacientes" },
  { pattern: /estoque|produto/i, route: "/app/estoque/produtos", label: "Estoque" },
  { pattern: /dashboard|relat/i, route: "/app/dashboard", label: "Dashboard" },
];

export function interpretSearchLiteral(query: string): SmartSearchResult | null {
  for (const r of ROUTES) {
    if (r.pattern.test(query)) {
      return { route: r.route, label: r.label, filters: r.filters };
    }
  }
  return null;
}

export async function interpretSmartSearch(
  organizationId: string,
  userId: string,
  query: string,
): Promise<SmartSearchResult> {
  const literal = interpretSearchLiteral(query);
  if (literal) return literal;

  try {
    const { text } = await aiComplete({
      organizationId,
      userId,
      resource: "SMART_SEARCH",
      system: "SMART_SEARCH: interprete busca em JSON {route, label, filters}",
      userMessage: query,
    });
    const parsed = JSON.parse(text) as SmartSearchResult;
    if (parsed.route) return parsed;
  } catch {
    // fallback
  }

  return { route: "/app/pacientes", literalQuery: query, label: `Buscar "${query}"` };
}

export const NAV_ITEMS = [
  { route: "/app/pacientes", label: "Pacientes", keywords: ["paciente", "cadastro"] },
  { route: "/app/agenda", label: "Agenda", keywords: ["agenda", "horário"] },
  { route: "/app/recepcao", label: "Recepção", keywords: ["recepção", "fila"] },
  { route: "/app/financeiro/receber", label: "A receber", keywords: ["financeiro", "cobrança"] },
  { route: "/app/dashboard", label: "Dashboard", keywords: ["bi", "indicadores"] },
  { route: "/app/configuracoes/ia", label: "Configurações IA", keywords: ["ia", "inteligência"] },
];
