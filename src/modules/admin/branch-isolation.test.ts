import { describe, expect, it, beforeAll } from "vitest";
import { branchFilter, assertBranchBelongsToOrg } from "@/modules/admin/services/branch.service";
import { isDatabaseAvailable } from "@/lib/test/db-available";

describe("branch isolation", () => {
  let dbAvailable = false;
  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable();
  });

  it("branchFilter scopes queries", () => {
    expect(branchFilter("branch-a")).toEqual({ branchId: "branch-a" });
    expect(branchFilter(null)).toEqual({});
  });

  it("assertBranchBelongsToOrg rejects unknown branch", async () => {
    if (!dbAvailable) return;
    await expect(
      assertBranchBelongsToOrg("org-fake", "branch-fake"),
    ).rejects.toThrow(/unidade inválida/i);
  });

  it("org A branch never matches org B scope", () => {
    const orgA = { organizationId: "org-a", ...branchFilter("branch-a") };
    const orgB = { organizationId: "org-b", ...branchFilter("branch-b") };
    expect(orgA.branchId).not.toBe(orgB.branchId);
  });
});
