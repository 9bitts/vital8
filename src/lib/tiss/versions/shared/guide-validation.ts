import type { TissGuideType } from "@/generated/prisma/client";
import type { TissValidationError } from "../../types";

export type GuideValidationInput = {
  guideType: TissGuideType;
  beneficiaryCard: string;
  beneficiaryCardValidUntil?: Date | null;
  beneficiaryName: string;
  ansRegistration: string;
  providerDocument: string;
  providerCnes?: string | null;
  professionalName: string;
  professionalCouncilNumber?: string | null;
  beneficiaryCpf?: string | null;
  tussCode?: string | null;
  requiresAuthorization: boolean;
  authorizationValid?: boolean;
  procedures: Array<{ tussCode: string; quantity: number; unitValueCents: number }>;
  consultationType?: string | null;
};

export function validateGuideFieldsBase(
  input: GuideValidationInput,
): TissValidationError[] {
  const errors: TissValidationError[] = [];

  if (!input.beneficiaryName?.trim()) {
    errors.push({ field: "beneficiaryName", message: "Nome do beneficiário obrigatório" });
  }
  if (!input.beneficiaryCard?.trim() && !input.beneficiaryCpf?.trim()) {
    errors.push({
      field: "beneficiaryCard",
      message: "Informe número da carteirinha ou CPF do beneficiário",
    });
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
  if (!input.professionalCouncilNumber?.trim()) {
    errors.push({
      field: "professionalCouncilNumber",
      message: "Número do conselho profissional é obrigatório",
    });
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
