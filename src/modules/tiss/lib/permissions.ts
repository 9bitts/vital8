import type { Plan, Role } from "@/generated/prisma/client";
import { hasFeature } from "@/lib/features/features.service";

export function canManageTissBilling(role: Role): boolean {
  return ["OWNER", "ADMIN", "FINANCEIRO"].includes(role);
}

export function canViewTissEligibility(role: Role): boolean {
  return ["OWNER", "ADMIN", "FINANCEIRO", "RECEPCAO"].includes(role);
}

export function canViewOwnTissProduction(role: Role): boolean {
  return role === "PROFISSIONAL_SAUDE";
}

export function isTissEnabledForPlan(plan: Plan): boolean {
  return hasFeature(plan, "tiss");
}
