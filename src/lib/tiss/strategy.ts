import { normalizeTissVersion } from "./version";
import { buildBatchXml305 } from "./versions/3.05/builder";
import { validateGuideFields305 } from "./versions/3.05/guide-validation";
import { validateXmlStructure305 } from "./versions/3.05/validator";
import { buildBatchXml403 } from "./versions/4.03/builder";
import { validateGuideFields403, validateXmlStructure403 } from "./versions/4.03/validator";
import type { TissVersionStrategy } from "./versions/types";

const STRATEGIES: Record<string, TissVersionStrategy> = {
  "3.05.00": {
    version: "3.05.00",
    xsdPath: "src/lib/tiss/schemas/3.05/tissV30500.xsd",
    buildBatchXml: buildBatchXml305,
    validateXmlStructure: validateXmlStructure305,
    validateGuideFields: validateGuideFields305,
  },
  "4.03.00": {
    version: "4.03.00",
    xsdPath: "src/lib/tiss/schemas/4.03/tissV40300.xsd",
    buildBatchXml: buildBatchXml403,
    validateXmlStructure: validateXmlStructure403,
    validateGuideFields: validateGuideFields403,
  },
};

export function getTissStrategy(tissVersion: string): TissVersionStrategy {
  const normalized = normalizeTissVersion(tissVersion);
  const strategy = STRATEGIES[normalized];
  if (!strategy) {
    throw new Error(`Versão TISS não suportada: ${tissVersion}`);
  }
  return strategy;
}
