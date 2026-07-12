import type { TissValidationError } from "./types";
import { normalizeTissVersion } from "./version";

export type BatchGuideValidationInput = {
  guideNumber: number;
  guideType: string;
  beneficiaryName: string;
  beneficiaryCard?: string | null;
  beneficiaryCpf?: string | null;
  professionalName: string;
  professionalCouncilNumber?: string | null;
  procedures: Array<{ tussCode: string; quantity: number; unitValueCents: number }>;
  totalValueCents: number;
};

export type BatchValidationInput = {
  batchNumber: number;
  competence: string;
  ansRegistration: string;
  providerDocument: string;
  organizationName: string;
  providerCnes?: string | null;
  providerCodeAtInsurer?: string | null;
  tissVersion: string;
  guides: BatchGuideValidationInput[];
};

function requireField(
  value: string | null | undefined,
  field: string,
  label: string,
): TissValidationError | null {
  if (!value?.trim()) return { field, message: `${label} é obrigatório` };
  return null;
}

function validateGuide(guide: BatchGuideValidationInput, index: number): TissValidationError[] {
  const prefix = `guides[${index}]`;
  const issues: TissValidationError[] = [];

  for (const issue of [
    requireField(guide.beneficiaryName, `${prefix}.beneficiaryName`, "Nome do beneficiário"),
    requireField(guide.professionalName, `${prefix}.professionalName`, "Nome do profissional"),
  ]) {
    if (issue) issues.push(issue);
  }

  if (!guide.beneficiaryCard?.trim() && !guide.beneficiaryCpf?.trim()) {
    issues.push({
      field: `${prefix}.beneficiaryCard`,
      message: "Informe número da carteirinha ou CPF do beneficiário",
    });
  }

  if (!guide.professionalCouncilNumber?.trim()) {
    issues.push({
      field: `${prefix}.professionalCouncilNumber`,
      message: "Número do conselho profissional é obrigatório",
    });
  }

  if (guide.procedures.length === 0) {
    issues.push({
      field: `${prefix}.procedures`,
      message: "Guia sem procedimentos TUSS",
    });
  }

  for (const proc of guide.procedures) {
    if (!proc.tussCode?.trim()) {
      issues.push({
        field: `${prefix}.procedures.tussCode`,
        message: "Código TUSS obrigatório",
      });
    }
    if (proc.unitValueCents <= 0) {
      issues.push({
        field: `${prefix}.procedures.unitValueCents`,
        message: "Valor do procedimento deve ser maior que zero",
      });
    }
  }

  if (guide.totalValueCents <= 0) {
    issues.push({
      field: `${prefix}.totalValueCents`,
      message: "Valor total da guia deve ser maior que zero",
    });
  }

  return issues;
}

/** Validação estrutural do lote antes do fechamento (port Doctor8 `validateTissBatch`). */
export function validateTissBatch(input: BatchValidationInput): TissValidationError[] {
  const issues: TissValidationError[] = [];

  if (!input.batchNumber || input.batchNumber <= 0) {
    issues.push({ field: "batchNumber", message: "Número do lote inválido" });
  }

  for (const issue of [
    requireField(input.competence, "competence", "Competência"),
    requireField(input.ansRegistration, "ansRegistration", "Registro ANS"),
    requireField(input.providerDocument, "providerDocument", "Documento do prestador"),
    requireField(input.organizationName, "organizationName", "Nome do prestador"),
  ]) {
    if (issue) issues.push(issue);
  }

  if (!input.ansRegistration?.trim() && !input.providerCodeAtInsurer?.trim()) {
    issues.push({
      field: "ansRegistration",
      message: "Informe registro ANS ou código do prestador na operadora",
    });
  }

  if (input.guides.length === 0) {
    issues.push({ field: "guides", message: "O lote deve conter ao menos uma guia" });
  }

  const version = normalizeTissVersion(input.tissVersion);
  if (version === "4.03.00" && !input.providerCnes?.trim()) {
    issues.push({
      field: "providerCnes",
      message: "CNES obrigatório para TISS 4.03 (componente organizacional)",
    });
  }

  input.guides.forEach((g, i) => issues.push(...validateGuide(g, i)));

  return issues;
}
