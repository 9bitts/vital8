import type { TissGuideType } from "@/generated/prisma/client";
import type { TissGuidePayload, TissValidationError } from "./types";

export type GuideValidationInput = {
  guideType: TissGuideType;
  beneficiaryCard: string;
  beneficiaryCardValidUntil?: Date | null;
  beneficiaryName: string;
  ansRegistration: string;
  providerDocument: string;
  professionalName: string;
  tussCode?: string | null;
  requiresAuthorization: boolean;
  authorizationValid?: boolean;
  procedures: Array<{ tussCode: string; quantity: number; unitValueCents: number }>;
  consultationType?: string | null;
};

export function validateGuideFields(
  input: GuideValidationInput,
): TissValidationError[] {
  const errors: TissValidationError[] = [];

  if (!input.beneficiaryName?.trim()) {
    errors.push({ field: "beneficiaryName", message: "Nome do beneficiário obrigatório" });
  }
  if (!input.beneficiaryCard?.trim()) {
    errors.push({ field: "beneficiaryCard", message: "Número da carteirinha obrigatório" });
  }
  if (input.beneficiaryCardValidUntil && input.beneficiaryCardValidUntil < new Date()) {
    errors.push({ field: "beneficiaryCardValidUntil", message: "Carteirinha vencida" });
  }
  if (!input.ansRegistration?.trim()) {
    errors.push({ field: "ansRegistration", message: "Registro ANS obrigatório" });
  }
  if (!input.providerDocument?.trim()) {
    errors.push({ field: "providerDocument", message: "Documento do prestador obrigatório" });
  }
  if (!input.professionalName?.trim()) {
    errors.push({ field: "professionalName", message: "Profissional executante obrigatório" });
  }
  if (!input.tussCode && input.procedures.length === 0) {
    errors.push({ field: "tussCode", message: "Código TUSS obrigatório para faturamento" });
  }
  if (input.guideType === "GUIA_CONSULTA" && !input.consultationType) {
    errors.push({ field: "consultationType", message: "Tipo de consulta obrigatório" });
  }
  if (input.requiresAuthorization && !input.authorizationValid) {
    errors.push({
      field: "priorAuthorization",
      message: "Autorização vigente obrigatória para este procedimento",
    });
  }

  for (const proc of input.procedures) {
    if (!proc.tussCode?.trim()) {
      errors.push({ field: "procedures.tussCode", message: "Procedimento sem código TUSS" });
    }
    if (proc.quantity <= 0) {
      errors.push({ field: "procedures.quantity", message: "Quantidade inválida" });
    }
    if (proc.unitValueCents <= 0) {
      errors.push({ field: "procedures.unitValueCents", message: "Valor unitário inválido" });
    }
  }

  return errors;
}

const REQUIRED_XML_MARKERS = [
  "mensagemTISS",
  "cabecalho",
  "identificacaoTransacao",
  "prestadorParaOperadora",
  "loteGuias",
  "epilogo",
  "hash",
] as const;

/** Validação estrutural do XML TISS (complementar ao XSD). */
export function validateTissXmlStructure(xml: string): TissValidationError[] {
  const errors: TissValidationError[] = [];

  for (const marker of REQUIRED_XML_MARKERS) {
    if (!xml.includes(`<${marker}`) && !xml.includes(`<${marker}>`)) {
      errors.push({ field: marker, message: `Elemento obrigatório ausente: ${marker}` });
    }
  }

  const hashMatch = xml.match(/<hash>([a-f0-9]{32})<\/hash>/i);
  if (!hashMatch) {
    errors.push({ field: "hash", message: "Hash MD5 inválido ou ausente no epílogo" });
  }

  if (!xml.includes('xmlns="http://www.ans.gov.br/padroes/tiss/schemas"')) {
    errors.push({ field: "xmlns", message: "Namespace TISS ANS ausente" });
  }

  return errors;
}

export function validateGuidePayload(payload: TissGuidePayload): TissValidationError[] {
  const errors: TissValidationError[] = [];
  if (!payload.dadosBeneficiario.numeroCarteira) {
    errors.push({ field: "numeroCarteira", message: "Carteirinha ausente no payload" });
  }
  if (payload.procedimentos.length === 0) {
    errors.push({ field: "procedimentos", message: "Nenhum procedimento no payload" });
  }
  return errors;
}
