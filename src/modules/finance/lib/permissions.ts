import type { Role } from "@/generated/prisma/client";

export function canAccessFinance(role: Role): boolean {
  return ["OWNER", "ADMIN", "RECEPCAO", "FINANCEIRO"].includes(role);
}

export function canManageFinance(role: Role): boolean {
  return ["OWNER", "ADMIN", "FINANCEIRO"].includes(role);
}

export function canManageCommissionRules(role: Role): boolean {
  return ["OWNER", "ADMIN"].includes(role);
}

export function canRefund(role: Role): boolean {
  return ["OWNER", "ADMIN"].includes(role);
}

export function canAuthorizeDiscount(role: Role): boolean {
  return ["OWNER", "ADMIN", "FINANCEIRO"].includes(role);
}

export function getDiscountLimitCents(role: Role): number {
  if (role === "RECEPCAO") return 5000; // R$ 50
  return Number.MAX_SAFE_INTEGER;
}

export function canViewOwnCommissionOnly(role: Role): boolean {
  return role === "PROFISSIONAL_SAUDE";
}
