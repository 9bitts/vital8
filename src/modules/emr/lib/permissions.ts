import type { Role } from "@/generated/prisma/client";

export const EMR_CLINICAL_ROLES: Role[] = [
  "OWNER",
  "ADMIN",
  "PROFISSIONAL_SAUDE",
];

export const EMR_METADATA_ROLES: Role[] = [
  "OWNER",
  "ADMIN",
  "PROFISSIONAL_SAUDE",
  "RECEPCAO",
  "LEITURA",
];

export const EMR_ADMIN_ROLES: Role[] = ["OWNER", "ADMIN"];

export function canViewClinicalContent(role: Role): boolean {
  return EMR_CLINICAL_ROLES.includes(role);
}

export function canViewRecordMetadata(role: Role): boolean {
  return EMR_METADATA_ROLES.includes(role);
}

export function canSignEncounter(role: Role): boolean {
  return role === "PROFISSIONAL_SAUDE" || role === "OWNER" || role === "ADMIN";
}

export function canViewAccessLog(role: Role): boolean {
  return EMR_ADMIN_ROLES.includes(role);
}

export function isFinanceBlocked(role: Role): boolean {
  return role === "FINANCEIRO";
}

export type OrgEmrSettings = {
  adminCanViewClinical?: boolean;
  professionalsCanViewOthers?: boolean;
};

export function parseEmrSettings(raw: unknown): OrgEmrSettings {
  if (!raw || typeof raw !== "object") return {};
  const s = raw as Record<string, unknown>;
  return {
    adminCanViewClinical:
      typeof s.adminCanViewClinical === "boolean"
        ? s.adminCanViewClinical
        : true,
    professionalsCanViewOthers:
      typeof s.professionalsCanViewOthers === "boolean"
        ? s.professionalsCanViewOthers
        : true,
  };
}

export function canViewRestrictedSection(
  restrictedToAuthor: boolean,
  authorUserId: string,
  viewerUserId: string,
  role: Role,
): boolean {
  if (!restrictedToAuthor) return canViewClinicalContent(role);
  return viewerUserId === authorUserId;
}
