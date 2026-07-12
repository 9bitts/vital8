import type { FiscalDocumentType } from "@/generated/prisma/client";

export type ReceitaSaudeSessionData = {
  patientName: string;
  patientCpf: string;
  beneficiaryCpf?: string;
  serviceDate: string;
  amountBrl: string;
  description: string;
};

export const RECEITA_SAUDE_OFFICIAL_URL =
  "https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/receita-saude";

export const RECEITA_SAUDE_APP_LINKS = {
  android:
    "https://play.google.com/store/apps/details?id=br.gov.receita.receitasaude",
  ios: "https://apps.apple.com/br/app/receita-sa%C3%BAde/id6478903842",
  web: "https://cav.receita.fazenda.gov.br/ecac/",
};

export function formatReceitaSaudeDescription(
  sessionDate: string,
  serviceType = "Prestação de serviços de saúde",
): string {
  const [y, m, d] = sessionDate.split("-");
  const brDate = d && m && y ? `${d}/${m}/${y}` : sessionDate;
  return `${serviceType} — atendimento em ${brDate}`;
}

export function getReceitaSaudeServiceCode(
  councilType?: string | null,
): string {
  const map: Record<string, string> = {
    CRP: "255 — Psicólogo",
    CRM: "201 — Médico",
    CRO: "203 — Dentista",
    CRF: "204 — Farmacêutico",
    COREN: "205 — Enfermeiro",
    CREFITO: "206 — Fisioterapeuta",
    CRN: "207 — Nutricionista",
  };
  if (!councilType) return "Serviço de saúde — consulte tabela Receita Saúde";
  return map[councilType.toUpperCase()] ?? `Serviço — ${councilType}`;
}

export function buildReceitaSaudeChecklist(
  lang: "pt" | "en" | "es" = "pt",
): string[] {
  if (lang === "en") {
    return [
      "Confirm you bill as individual (PF), not as a company (PJ/DMED).",
      "Open the Receita Saúde app or e-CAC and log in with gov.br.",
      "Issue one digital receipt per payment received from the patient.",
      "Enter patient CPF (payer) and beneficiary CPF if different.",
      "Use the correct service code for your council.",
      "Amount must match what was actually received.",
      "Monthly Carnê-Leão: declare revenue from PF patients each month.",
    ];
  }
  if (lang === "es") {
    return [
      "Confirme que factura como persona física (PF), no como empresa.",
      "Abra la app Receita Saúde o e-CAC con gov.br.",
      "Emita un recibo digital por cada pago recibido.",
      "CPF del pagador y del beneficiario si son distintos.",
      "Código de servicio según su consejo profesional.",
      "El valor debe coincidir con lo recibido.",
      "Carnê-Leão mensual: declare ingresos de pacientes PF cada mes.",
    ];
  }
  return [
    "Confirme que você atende como pessoa física (PF) — PJ usa DMED, não Receita Saúde.",
    "Acesse o app Receita Saúde ou o Carnê-Leão Web (e-CAC) com login gov.br.",
    "Emita um recibo digital para cada pagamento recebido do paciente.",
    "Informe o CPF de quem pagou e o CPF do beneficiário se forem pessoas diferentes.",
    "Use o código do serviço conforme seu conselho profissional.",
    "O valor deve ser exatamente o recebido na prestação do serviço.",
    "Todo mês: apure o Carnê-Leão com a receita declarada no Receita Saúde.",
  ];
}

export type ReceitaSaudeInput = {
  professionalName: string;
  professionalDocument: string;
  councilType?: string | null;
  councilNumber?: string | null;
  councilState?: string | null;
  patientName: string;
  patientCpf: string;
  serviceDescription: string;
  amountCents: number;
  paymentDate: Date;
  organizationName: string;
};

export function buildReceitaSaudeReceipt(input: ReceitaSaudeInput): {
  number: string;
  pdfBase64: string;
  payload: Record<string, unknown>;
} {
  const number = `RS${input.paymentDate.getFullYear()}${String(input.paymentDate.getMonth() + 1).padStart(2, "0")}${Date.now().toString().slice(-6)}`;

  const council =
    input.councilType && input.councilNumber
      ? `${input.councilType}/${input.councilState ?? ""} ${input.councilNumber}`
      : "";

  const text = [
    "RECIBO DE PRESTAÇÃO DE SERVIÇOS DE SAÚDE",
    "Receita Saúde — compatível com declaração carnê-leão",
    "",
    `Nº: ${number}`,
    `Data: ${input.paymentDate.toLocaleDateString("pt-BR")}`,
    "",
    "PRESTADOR",
    `Nome: ${input.professionalName}`,
    `CPF: ${formatCpf(input.professionalDocument)}`,
    council ? `Conselho: ${council}` : "",
    `Estabelecimento: ${input.organizationName}`,
    "",
    "TOMADOR (PACIENTE)",
    `Nome: ${input.patientName}`,
    `CPF: ${formatCpf(input.patientCpf)}`,
    "",
    "SERVIÇO",
    input.serviceDescription,
    `Valor: R$ ${(input.amountCents / 100).toFixed(2)}`,
    "",
    "Declaro ter recebido o valor acima referente aos serviços de saúde prestados.",
    "",
    "_______________________________",
    input.professionalName,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    number,
    pdfBase64: Buffer.from(text).toString("base64"),
    payload: {
      tipo: "RECIBO_RECEITA_SAUDE",
      numero: number,
      prestador: {
        nome: input.professionalName,
        cpf: input.professionalDocument.replace(/\D/g, ""),
        conselho: council || null,
      },
      tomador: {
        nome: input.patientName,
        cpf: input.patientCpf.replace(/\D/g, ""),
      },
      servico: input.serviceDescription,
      valorCents: input.amountCents,
      data: input.paymentDate.toISOString(),
    },
  };
}

export function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export type CarnêLeaoRow = {
  date: string;
  patientName: string;
  patientCpf: string;
  serviceDescription: string;
  amountCents: number;
  professionalName: string;
  documentNumber: string;
};

export function buildCarnêLeaoCsv(rows: CarnêLeaoRow[]): string {
  const header =
    "data;paciente_cpf;paciente_nome;servico;valor_centavos;profissional;documento_numero";
  const lines = rows.map((r) =>
    [
      r.date,
      r.patientCpf,
      r.patientName,
      r.serviceDescription.replace(/;/g, ","),
      r.amountCents,
      r.professionalName,
      r.documentNumber,
    ].join(";"),
  );
  return [header, ...lines].join("\n");
}

export function documentTypeLabel(type: FiscalDocumentType): string {
  return type === "NFSE" ? "NFS-e" : "Recibo Receita Saúde";
}
