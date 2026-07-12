import { describe, it, expect, vi } from "vitest";
import { applyValidatedSessionUpdate } from "./jwt-session-update";

describe("applyValidatedSessionUpdate", () => {
  const baseToken = {
    id: "user-a",
    organizationId: "org-a",
    role: "OWNER" as const,
    branchId: "branch-a",
  };

  it("rejects org switch when user has no membership in target org", async () => {
    const resolveMembership = vi.fn(async () => null);
    const validateBranch = vi.fn(async () => true);

    const result = await applyValidatedSessionUpdate(
      baseToken,
      { organizationId: "org-b", role: "OWNER" },
      { resolveMembership, validateBranch },
    );

    expect(result.organizationId).toBe("org-a");
    expect(result.role).toBe("OWNER");
    expect(resolveMembership).toHaveBeenCalledWith("user-a", "org-b");
  });

  it("uses role from database, ignoring client-supplied role", async () => {
    const resolveMembership = vi.fn(async () => ({
      organizationId: "org-b",
      role: "LEITURA" as const,
    }));
    const validateBranch = vi.fn(async () => true);

    const result = await applyValidatedSessionUpdate(
      baseToken,
      { organizationId: "org-b", role: "OWNER" },
      { resolveMembership, validateBranch },
    );

    expect(result.organizationId).toBe("org-b");
    expect(result.role).toBe("LEITURA");
    expect(result.branchId).toBeNull();
  });

  it("ignores branchId from another organization", async () => {
    const resolveMembership = vi.fn(async () => ({
      organizationId: "org-a",
      role: "OWNER" as const,
    }));
    const validateBranch = vi.fn(async () => false);

    const result = await applyValidatedSessionUpdate(
      baseToken,
      { branchId: "branch-other-org" },
      { resolveMembership, validateBranch },
    );

    expect(result.branchId).toBe("branch-a");
    expect(validateBranch).toHaveBeenCalledWith("branch-other-org", "org-a");
  });

  it("accepts branchId that belongs to active organization", async () => {
    const resolveMembership = vi.fn(async () => null);
    const validateBranch = vi.fn(async () => true);

    const result = await applyValidatedSessionUpdate(
      baseToken,
      { branchId: "branch-b" },
      { resolveMembership, validateBranch },
    );

    expect(result.branchId).toBe("branch-b");
  });
});
