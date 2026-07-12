export type TemplateVars = {
  paciente?: string;
  data?: string;
  hora?: string;
  profissional?: string;
  clinica?: string;
  link?: string;
  servico?: string;
  descadastro?: string;
};

export function renderMessageTemplate(
  body: string,
  vars: TemplateVars,
): string {
  let out = body;
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) continue;
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

export const DEFAULT_TEMPLATE_VARS = [
  "paciente",
  "data",
  "hora",
  "profissional",
  "clinica",
  "link",
  "servico",
  "descadastro",
] as const;

export function marketingFooter(unsubscribeUrl: string): string {
  return `\n\n---\nPara não receber mais mensagens promocionais: ${unsubscribeUrl}`;
}
