import type { Role } from "@/generated/prisma/client";

const READ_ROLES: Role[] = [
  "OWNER",
  "ADMIN",
  "PROFISSIONAL_SAUDE",
  "RECEPCAO",
  "FINANCEIRO",
  "LEITURA",
];

const WRITE_ROLES: Role[] = [
  "OWNER",
  "ADMIN",
  "PROFISSIONAL_SAUDE",
  "RECEPCAO",
];

const HEALTH_ROLES: Role[] = ["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"];

const ADMIN_ROLES: Role[] = ["OWNER", "ADMIN"];

export function canReadPatients(role: Role): boolean {
  return READ_ROLES.includes(role);
}

export function canWritePatients(role: Role): boolean {
  return WRITE_ROLES.includes(role);
}

export function canViewPatientHealth(role: Role): boolean {
  return HEALTH_ROLES.includes(role);
}

export function canWritePatientHealth(role: Role): boolean {
  return HEALTH_ROLES.includes(role);
}

export function canAdminPatients(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}
