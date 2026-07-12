import { describe, expect, it } from "vitest";
import { hasFeature } from "@/lib/features/features.service";

describe("inventory feature flag", () => {
  it("enabled on PRO and ENTERPRISE", () => {
    expect(hasFeature("PRO", "inventory")).toBe(true);
    expect(hasFeature("ENTERPRISE", "inventory")).toBe(true);
    expect(hasFeature("STARTER", "inventory")).toBe(false);
  });
});
