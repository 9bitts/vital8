import { describe, expect, it } from "vitest";
import { hasFeature } from "@/lib/features/features.service";

describe("TISS feature flag", () => {
  it("enabled on PRO and ENTERPRISE", () => {
    expect(hasFeature("PRO", "tiss")).toBe(true);
    expect(hasFeature("ENTERPRISE", "tiss")).toBe(true);
    expect(hasFeature("STARTER", "tiss")).toBe(false);
  });
});
