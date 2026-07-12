import type { GuideValidationInput } from "../../validator";
import type { TissValidationError } from "../../types";
import { validateGuideFieldsBase } from "../shared/guide-validation";

export function validateGuideFields305(input: GuideValidationInput): TissValidationError[] {
  return validateGuideFieldsBase(input);
}
