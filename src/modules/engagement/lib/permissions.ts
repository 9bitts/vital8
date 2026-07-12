import type { Role } from "@/generated/prisma/client";

export function canManageEngagementConfig(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canOperateCommunications(role: Role): boolean {
  return ["OWNER", "ADMIN", "RECEPCAO"].includes(role);
}

export function canApproveOnlineBooking(role: Role): boolean {
  return ["OWNER", "ADMIN", "RECEPCAO"].includes(role);
}

export function canReleaseClinicalDocument(role: Role): boolean {
  return ["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"].includes(role);
}

export function canManageCampaigns(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canViewNpsReport(role: Role): boolean {
  return ["OWNER", "ADMIN", "RECEPCAO"].includes(role);
}
