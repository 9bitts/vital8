import type { BatchXmlInput, BatchXmlResult, TissValidationError } from "../types";
import type { GuideValidationInput } from "./shared/guide-validation";

export type TissVersionStrategy = {
  version: string;
  xsdPath: string;
  buildBatchXml: (input: BatchXmlInput) => BatchXmlResult;
  validateXmlStructure: (xml: string) => TissValidationError[];
  validateGuideFields: (input: GuideValidationInput) => TissValidationError[];
};
