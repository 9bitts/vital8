import type { LgpdExportData } from "@/modules/patients/services/patient.service";
import { formatCpf, formatPhone } from "@/lib/crypto/search-hash";

/** Gera PDF mínimo (1.4) com dados LGPD — sem dependências externas. */
export function generateLgpdPdf(data: LgpdExportData): Buffer {
  const p = data.patient;
  const lines = [
    "Vital8 - Exportacao LGPD do Titular",
    `Gerado em: ${data.exportedAt}`,
    "",
    `Nome: ${p.fullName}`,
    p.socialName ? `Nome social: ${p.socialName}` : "",
    p.cpf ? `CPF: ${formatCpf(p.cpf)}` : "",
    p.birthDate
      ? `Nascimento: ${new Date(p.birthDate).toLocaleDateString("pt-BR")}`
      : "",
    p.phones[0] ? `Telefone: ${formatPhone(p.phones[0].number)}` : "",
    p.email ? `E-mail: ${p.email}` : "",
    "",
    `Alergias: ${data.allergies.map((a) => a.substance).join(", ") || "Nenhuma"}`,
    `Condicoes: ${data.chronicConditions.map((c) => c.condition).join(", ") || "Nenhuma"}`,
    `Medicamentos: ${data.medications.map((m) => m.name).join(", ") || "Nenhum"}`,
    `Consentimentos: ${data.consents.length}`,
    `Documentos: ${data.documents.length}`,
  ].filter(Boolean);

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

function buildTextStream(lines: string[]): string {
  let y = 800;
  const parts = ["BT", "/F1 11 Tf"];
  for (const line of lines) {
    const safe = escapePdfText(line);
    parts.push(`50 ${y} Td (${safe}) Tj`);
    parts.push("0 -16 Td");
    y -= 16;
  }
  parts.push("ET");
  return parts.join("\n");
}

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}
