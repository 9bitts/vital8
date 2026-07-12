import { describe, expect, it } from "vitest";
import { linearProjection } from "./lib/periods";

describe("goal projection", () => {
  it("projects linear closure", () => {
    expect(linearProjection(1000, 10, 30)).toBe(3000);
    expect(linearProjection(0, 15, 30)).toBe(0);
  });
});

describe("service margin formula", () => {
  it("computes margin as revenue minus kit and commission", () => {
    const revenueCents = 20000;
    const kitCostCents = 3500;
    const commissionCents = 6000;
    const margin = revenueCents - kitCostCents - commissionCents;
    expect(margin).toBe(10500);
    expect(Math.round((margin / revenueCents) * 100)).toBe(53);
  });
});
