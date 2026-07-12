import { describe, expect, it } from "vitest";
import { canGrantRole, roleRank } from "@/lib/auth/role-hierarchy";
import type { Role } from "@/generated/prisma/client";

describe("role escalation guard", () => {
  it("ADMIN cannot grant OWNER", () => {
    expect(canGrantRole("ADMIN", "OWNER")).toBe(false);
  });

  it("ADMIN can grant RECEPCAO", () => {
    expect(canGrantRole("ADMIN", "RECEPCAO")).toBe(true);
  });

  it("ADMIN can grant ADMIN (same level)", () => {
    expect(canGrantRole("ADMIN", "ADMIN")).toBe(true);
  });

  it("RECEPCAO cannot grant FINANCEIRO", () => {
    expect(canGrantRole("RECEPCAO", "FINANCEIRO")).toBe(false);
  });

  it("OWNER rank is highest", () => {
    const roles: Role[] = [
      "LEITURA",
      "RECEPCAO",
      "ESTOQUE",
      "FINANCEIRO",
      "PROFISSIONAL_SAUDE",
      "ADMIN",
      "OWNER",
    ];
    for (let i = 1; i < roles.length; i++) {
      expect(roleRank(roles[i]!)).toBeGreaterThan(roleRank(roles[i - 1]!));
    }
  });
});
