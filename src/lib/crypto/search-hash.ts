import { createHash } from "crypto";

/** Normaliza CPF para apenas dígitos. */
export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

/** Hash SHA-256 para busca/deduplicação de CPF por organização. */
export function hashCpf(cpf: string): string {
  const normalized = normalizeCpf(cpf);
  return createHash("sha256").update(normalized).digest("hex");
}

/** Normaliza telefone para apenas dígitos (busca parcial). */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Normaliza nome para busca (minúsculas, sem acentos, espaços colapsados). */
export function normalizeSearchName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Valida dígitos verificadores do CPF brasileiro. */
export function isValidCpf(cpf: string): boolean {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]!, 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9]!, 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]!, 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(digits[10]!, 10);
}

/** Formata CPF para exibição. */
export function formatCpf(cpf: string): string {
  const d = normalizeCpf(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Formata telefone BR para exibição. */
export function formatPhone(phone: string): string {
  const d = normalizePhone(phone);
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return phone;
}
