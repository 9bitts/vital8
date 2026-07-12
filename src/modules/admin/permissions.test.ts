import { describe, expect, it } from "vitest";
import { checkPermission, DEFAULT_PROFILES } from "@/lib/auth/permissions";

describe("permission profiles", () => {
  it("RECEPCAO cannot view prontuario by default", () => {
    expect(checkPermission(DEFAULT_PROFILES.RECEPCAO.permissions, "prontuario.view", "RECEPCAO")).toBe(false);
  });

  it("FINANCEIRO cannot view prontuario", () => {
    expect(checkPermission(DEFAULT_PROFILES.FINANCEIRO.permissions, "prontuario.view", "FINANCEIRO")).toBe(false);
  });

  it("custom profile overrides base role", () => {
    const custom = {
      ...DEFAULT_PROFILES.RECEPCAO.permissions,
      prontuario: { view: true },
    };
    expect(checkPermission(custom, "prontuario.view", "RECEPCAO")).toBe(true);
  });

  it("OWNER can approve financeiro", () => {
    expect(checkPermission(DEFAULT_PROFILES.OWNER.permissions, "financeiro.approve", "OWNER")).toBe(true);
  });
});
