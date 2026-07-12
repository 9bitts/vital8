import type { Role } from "@/generated/prisma/client";

/** Ordem crescente de privilégio — convidador não pode conceder papel acima do próprio. */
const ROLE_RANK: Record<Role, number> = {
  LEITURA: 0,
  RECEPCAO: 10,
  ESTOQUE: 20,
  FINANCEIRO: 30,
  PROFISSIONAL_SAUDE: 40,
  ADMIN: 50,
  OWNER: 60,
};

export function roleRank(role: Role): number {
  return ROLE_RANK[role] ?? 0;
}

export function canGrantRole(granterRole: Role, targetRole: Role): boolean {
  if (targetRole === "OWNER") return false;
  return roleRank(granterRole) >= roleRank(targetRole);
}
