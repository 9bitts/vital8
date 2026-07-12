import type { Role } from "@/generated/prisma/client";

export const AGENDA_READ_ROLES: Role[] = [
  "OWNER",
  "ADMIN",
  "PROFISSIONAL_SAUDE",
  "RECEPCAO",
  "LEITURA",
];

export const AGENDA_WRITE_ROLES: Role[] = [
  "OWNER",
  "ADMIN",
  "PROFISSIONAL_SAUDE",
  "RECEPCAO",
];

export const RECEPTION_ROLES: Role[] = ["OWNER", "ADMIN", "RECEPCAO"];

export const SQUEEZE_ROLES: Role[] = ["OWNER", "ADMIN"];

export const CONFIG_ROLES: Role[] = ["OWNER", "ADMIN"];

export function canManageAgenda(role: Role): boolean {
  return AGENDA_WRITE_ROLES.includes(role);
}

export function canManageReception(role: Role): boolean {
  return RECEPTION_ROLES.includes(role);
}

export function canAllowSqueeze(role: Role): boolean {
  return SQUEEZE_ROLES.includes(role);
}

export function canViewAllProfessionals(role: Role): boolean {
  return ["OWNER", "ADMIN", "RECEPCAO"].includes(role);
}

export function canConfigureScheduling(role: Role): boolean {
  return CONFIG_ROLES.includes(role);
}

export function canCallPatient(role: Role): boolean {
  return ["OWNER", "ADMIN", "PROFISSIONAL_SAUDE", "RECEPCAO"].includes(role);
}
