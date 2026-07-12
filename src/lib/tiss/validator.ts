import { getTissStrategy } from "./strategy";
import type { TissGuidePayload, TissValidationError } from "./types";
import { validateGuideFieldsBase, type GuideValidationInput } from "./versions/shared/guide-validation";

export type { GuideValidationInput };

export function validateGuideFields(
  input: GuideValidationInput,
  tissVersion = "3.05.00",
): TissValidationError[] {
  const strategy = getTissStrategy(tissVersion);
  return strategy.validateGuideFields(input);
}

/** Validação estrutural do XML TISS (complementar ao XSD). */
export function validateTissXmlStructure(
  xml: string,
  tissVersion = "3.05.00",
): TissValidationError[] {
  const strategy = getTissStrategy(tissVersion);
  return strategy.validateXmlStructure(xml);
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

/** Re-export para compatibilidade com imports legados. */
export { validateGuideFieldsBase };
