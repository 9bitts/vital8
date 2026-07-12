import type { Role } from "@/generated/prisma/client";

export function canAccessInventory(role: Role): boolean {
  return [
    "OWNER",
    "ADMIN",
    "ESTOQUE",
    "FINANCEIRO",
    "RECEPCAO",
  ].includes(role);
}

export function canManageInventory(role: Role): boolean {
  return ["OWNER", "ADMIN", "ESTOQUE"].includes(role);
}

export function canAdjustInventory(role: Role): boolean {
  return ["OWNER", "ADMIN", "ESTOQUE"].includes(role);
}

export function canViewControlledReport(role: Role): boolean {
  return ["OWNER", "ADMIN"].includes(role);
}

export function isInventoryReadOnly(role: Role): boolean {
  return role === "RECEPCAO" || role === "LEITURA";
}
