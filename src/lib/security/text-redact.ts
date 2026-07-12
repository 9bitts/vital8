const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}\b/g;

/** Redação de PHI de terceiros em texto livre para exportação LGPD. */
export function redactThirdPartyText(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  return text
    .replace(CPF_PATTERN, "[CPF REDACTED]")
    .replace(EMAIL_PATTERN, "[EMAIL REDACTED]")
    .replace(PHONE_PATTERN, "[TELEFONE REDACTED]")
    .replace(/\b(?:Sr\.|Sra\.|Dr\.|Dra\.)\s+[A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){0,3}\b/g, "[TERCEIRO REDACTED]");
}
