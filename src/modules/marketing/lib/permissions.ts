import type { Role } from "@/generated/prisma/client";

export function canViewMarketing(role: Role): boolean {
  return ["OWNER", "ADMIN", "RECEPCAO"].includes(role);
}

export function canManageMarketing(role: Role): boolean {
  return ["OWNER", "ADMIN"].includes(role);
}

export function canManageLandingPages(role: Role): boolean {
  return ["OWNER", "ADMIN"].includes(role);
}

export function canOperateLeads(role: Role): boolean {
  return ["OWNER", "ADMIN", "RECEPCAO"].includes(role);
}
