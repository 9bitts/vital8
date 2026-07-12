/** Gera PDF mínimo (1.4) — reutiliza padrão do LGPD export. */

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E\n]/g, "?");
}

function buildTextStream(lines: string[]): string {
  let y = 800;
  const parts = ["BT", "/F1 11 Tf"];
  for (const line of lines) {
    const safe = escapePdfText(line);
    parts.push(`50 ${y} Td (${safe}) Tj`);
    parts.push("0 -16 Td");
    y -= 16;
    if (y < 50) break;
  }
  parts.push("ET");
  return parts.join("\n");
}

function buildPdf(lines: string[]): Buffer {
  const contentStream = buildTextStream(lines);
  const objects: string[] = [];

  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj",
  );
  objects.push(
    `4 0 obj<< /Length ${contentStream.length} >>stream\n${contentStream}\nendstream endobj`,
  );
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export type PdfHeader = {
  orgName: string;
  orgAddress?: string;
  professionalName: string;
  council?: string;
  councilNumber?: string;
  councilState?: string;
};

function headerLines(h: PdfHeader): string[] {
  const council = h.council
    ? `${h.council} ${h.councilNumber ?? ""}/${h.councilState ?? ""}`.trim()
    : "";
  return [
    h.orgName,
    h.orgAddress ?? "",
    h.professionalName,
    council,
    "",
  ].filter(Boolean);
}

export type PrescriptionPdfInput = {
  header: PdfHeader;
  patientName: string;
  type: "COMUM" | "CONTROLE_ESPECIAL";
  items: Array<{
    drugName: string;
    dosage: string;
    route?: string | null;
    quantity?: string | null;
  }>;
  date: Date;
  validationCode?: string | null;
  validationUrl?: string | null;
  controlBookNumber?: string | null;
};

export function generatePrescriptionPdf(input: PrescriptionPdfInput): Buffer {
  const lines = [
    ...headerLines(input.header),
    input.type === "CONTROLE_ESPECIAL"
      ? "RECEITUARIO DE CONTROLE ESPECIAL - Portaria 344/98"
      : "RECEITUARIO MEDICO DIGITAL",
    `Paciente: ${input.patientName}`,
    `Data: ${input.date.toLocaleDateString("pt-BR")}`,
    input.controlBookNumber
      ? `Livro/Numero controle especial: ${input.controlBookNumber}`
      : "",
    "",
    ...input.items.flatMap((item, i) => [
      `${i + 1}. ${item.drugName}`,
      `   Posologia: ${item.dosage}${item.route ? ` (${item.route})` : ""}`,
      item.quantity ? `   Quantidade: ${item.quantity}` : "",
      "",
    ]),
  ].filter((l) => l !== undefined) as string[];

  if (input.validationCode && input.validationUrl) {
    lines.push(
      "--- VALIDACAO FARMACIA (CFM) ---",
      `Codigo: ${input.validationCode}`,
      `URL: ${input.validationUrl}`,
      "Escaneie ou informe o codigo na farmacia.",
      "",
    );
  }

  if (input.type === "CONTROLE_ESPECIAL") {
    lines.push("--- SEGUNDA VIA (PACIENTE) ---", "");
    lines.push(...input.items.map((item, i) => `${i + 1}. ${item.drugName} - ${item.dosage}`));
  }

  return buildPdf(lines);
}

export type CertificatePdfInput = {
  header: PdfHeader;
  patientName: string;
  body: string;
  date: Date;
};

export function generateCertificatePdf(input: CertificatePdfInput): Buffer {
  const lines = [
    ...headerLines(input.header),
    "DOCUMENTO MEDICO",
    `Paciente: ${input.patientName}`,
    `Data: ${input.date.toLocaleDateString("pt-BR")}`,
    "",
    input.body,
  ];
  return buildPdf(lines);
}

export type ExamRequestPdfInput = {
  header: PdfHeader;
  patientName: string;
  exams: string[];
  notes?: string;
  date: Date;
};

export function generateExamRequestPdf(input: ExamRequestPdfInput): Buffer {
  const lines = [
    ...headerLines(input.header),
    "SOLICITACAO DE EXAMES",
    `Paciente: ${input.patientName}`,
    `Data: ${input.date.toLocaleDateString("pt-BR")}`,
    "",
    ...input.exams.map((e, i) => `${i + 1}. ${e}`),
    input.notes ? `\nObs: ${input.notes}` : "",
  ].filter(Boolean) as string[];
  return buildPdf(lines);
}

export type EncounterSummaryPdfInput = {
  header: PdfHeader;
  patientName: string;
  specialty?: string | null;
  modality: string;
  startedAt: Date;
  sectionSummaries: string[];
};

export function generateEncounterSummaryPdf(
  input: EncounterSummaryPdfInput,
): Buffer {
  const lines = [
    ...headerLines(input.header),
    "REGISTRO CLINICO ASSINADO",
    `Paciente: ${input.patientName}`,
    `Especialidade: ${input.specialty ?? "—"}`,
    `Modalidade: ${input.modality}`,
    `Início: ${input.startedAt.toLocaleString("pt-BR")}`,
    "",
    "Resumo das seções:",
    ...input.sectionSummaries.map((s, i) => `${i + 1}. ${s}`),
  ];
  return buildPdf(lines);
}

export type ExamResultPdfInput = {
  header: PdfHeader;
  patientName: string;
  fileName?: string | null;
  values: Array<{ name: string; value: string; unit?: string | null }>;
  notes?: string | null;
  date: Date;
};

export function generateExamResultPdf(input: ExamResultPdfInput): Buffer {
  const lines = [
    ...headerLines(input.header),
    "LAUDO DE EXAME",
    `Paciente: ${input.patientName}`,
    `Data: ${input.date.toLocaleDateString("pt-BR")}`,
    input.fileName ? `Arquivo: ${input.fileName}` : "",
    "",
    ...input.values.map(
      (v, i) =>
        `${i + 1}. ${v.name}: ${v.value}${v.unit ? ` ${v.unit}` : ""}`,
    ),
    input.notes ? `\nObs: ${input.notes}` : "",
  ].filter(Boolean) as string[];
  return buildPdf(lines);
}

export function renderDocumentTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
