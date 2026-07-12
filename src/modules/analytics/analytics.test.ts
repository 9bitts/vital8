import { describe, expect, it } from "vitest";
import {
  linearProjection,
  monthRange,
  pctChange,
  previousMonth,
  toSpDateKey,
} from "./lib/periods";

describe("period comparatives", () => {
  it("calculates pct change", () => {
    expect(pctChange(120, 100)).toBe(20);
    expect(pctChange(0, 0)).toBe(0);
  });

  it("previous month wraps year", () => {
    expect(previousMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });

  it("linear projection", () => {
    expect(linearProjection(1000, 10, 30)).toBe(3000);
  });

  it("SP date key", () => {
    const key = toSpDateKey(new Date("2026-07-15T17:00:00.000Z"));
    expect(key).toMatch(/2026-07-1[45]/);
  });
});

describe("month range", () => {
  it("returns july 2026 bounds", () => {
    const r = monthRange(2026, 7);
    expect(r.label).toBe("7/2026");
    expect(r.from.getTime()).toBeLessThan(r.to.getTime());
  });
});
