/** Versões TISS suportadas pelo Vital8. */
export const SUPPORTED_TISS_VERSIONS = ["3.05.00", "4.03.00"] as const;

export type SupportedTissVersion = (typeof SUPPORTED_TISS_VERSIONS)[number];

/** Prazo regulatório ANS — faturamento inválido com versões anteriores a 4.03. */
export const TISS_403_REGULATORY_DEADLINE = "2026-07-01";

export function normalizeTissVersion(version: string): SupportedTissVersion {
  const v = version.trim();
  if (v.startsWith("4.")) return "4.03.00";
  return "3.05.00";
}

export function isSupportedTissVersion(version: string): boolean {
  const normalized = normalizeTissVersion(version);
  return SUPPORTED_TISS_VERSIONS.includes(normalized);
}

export function isTissVersionDeprecated(version: string): boolean {
  return normalizeTissVersion(version) === "3.05.00";
}

export function tissVersionLabel(version: string): string {
  const n = normalizeTissVersion(version);
  if (n === "4.03.00") return "4.03.00 (obrigatório desde jul/2026)";
  return "3.05.00 (legado — inválido após jul/2026)";
}
