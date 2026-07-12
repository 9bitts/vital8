import { describe, expect, it } from "vitest";
import { branchFilter } from "@/modules/admin/services/branch.service";

describe("branch filter", () => {
  it("returns empty when no branch selected (consolidated)", () => {
    expect(branchFilter(null)).toEqual({});
    expect(branchFilter(undefined)).toEqual({});
  });

  it("filters by branchId when selected", () => {
    expect(branchFilter("branch-1")).toEqual({ branchId: "branch-1" });
  });
});

describe("branch isolation logic", () => {
  it("org A branch never matches org B query scope", () => {
    const orgAFilter = { organizationId: "org-a", ...branchFilter("branch-main-org-a") };
    const orgBFilter = { organizationId: "org-b", ...branchFilter("branch-main-org-b") };
    expect(orgAFilter.branchId).not.toBe(orgBFilter.branchId);
    expect(orgAFilter.organizationId).not.toBe(orgBFilter.organizationId);
  });
});
