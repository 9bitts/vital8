import { getTissStrategy } from "./strategy";
import type { BatchXmlInput, BatchXmlResult } from "./types";

export type { BatchXmlInput, BatchXmlResult } from "./types";

/** Gera XML de lote TISS conforme versão da operadora (3.05 ou 4.03). */
export function buildTissBatchXml(input: BatchXmlInput): BatchXmlResult {
  const strategy = getTissStrategy(input.tissVersion);
  return strategy.buildBatchXml({
    ...input,
    tissVersion: strategy.version,
  });
}
