const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const PHONE_PATTERN = /\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}/g;
const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.\w+/gi;

function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P.";
  if (parts.length === 1) return `${parts[0]!.charAt(0).toUpperCase()}.`;
  return `${parts[0]!.charAt(0).toUpperCase()}.${parts[parts.length - 1]!.charAt(0).toUpperCase()}.`;
}

export function minimizeTextForLlm(text: string): string {
  return text
    .replace(CPF_PATTERN, "[CPF_REMOVIDO]")
    .replace(PHONE_PATTERN, "[TEL_REMOVIDO]")
    .replace(EMAIL_PATTERN, "[EMAIL_REMOVIDO]");
}

export function minimizePatientContext(input: {
  fullName?: string | null;
  cpf?: string | null;
  phones?: { number: string }[];
  email?: string | null;
  address?: Record<string, string | undefined> | null;
  notes?: string | null;
  [key: string]: unknown;
}): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  if (input.fullName) out.fullName = toInitials(input.fullName);
  delete out.cpf;
  delete out.phones;
  delete out.email;
  delete out.address;
  if (typeof input.notes === "string") out.notes = minimizeTextForLlm(input.notes);
  return out;
}

export function minimizeJsonPayload(payload: unknown): unknown {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload === "string") return minimizeTextForLlm(payload);
  if (Array.isArray(payload)) return payload.map(minimizeJsonPayload);
  if (typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (["cpf", "cpfHash", "cpfEncrypted", "phoneSearch", "phonesEncrypted", "emailEncrypted"].includes(k)) {
        continue;
      }
      if (k === "fullName" && typeof v === "string") {
        result[k] = toInitials(v);
      } else if (k === "address") {
        continue;
      } else {
        result[k] = minimizeJsonPayload(v);
      }
    }
    return result;
  }
  return payload;
}

export { toInitials };
