import { describe, expect, it } from "vitest";
import {
  purchaseToConsumeQty,
  purchaseUnitCostToConsumeUnitCost,
  planFEFOAllocation,
  recalculateMovingAverage,
  requiresReason,
} from "./lib/inventory-utils";

describe("inventory unit conversion", () => {
  it("converts purchase qty to consume qty", () => {
    expect(purchaseToConsumeQty(2, 100)).toBe(200);
  });

  it("converts purchase unit cost to consume unit cost", () => {
    expect(purchaseUnitCostToConsumeUnitCost(10000, 100)).toBe(100);
  });
});

describe("moving average cost", () => {
  it("recalculates on entry", () => {
    expect(recalculateMovingAverage(100, 100, 50, 200)).toBe(133);
  });

  it("returns incoming cost when no stock", () => {
    expect(recalculateMovingAverage(0, 0, 10, 500)).toBe(500);
  });
});

describe("FEFO allocation", () => {
  it("consumes nearest expiry first", () => {
    const { allocations, remaining } = planFEFOAllocation(
      [
        { batchId: "b1", quantity: 50, expiryDate: new Date("2026-12-01") },
        { batchId: "b2", quantity: 50, expiryDate: new Date("2026-06-01") },
      ],
      60,
    );
    expect(allocations).toEqual([
      { batchId: "b2", take: 50 },
      { batchId: "b1", take: 10 },
    ]);
    expect(remaining).toBe(0);
  });

  it("reports remaining when stock insufficient", () => {
    const { remaining } = planFEFOAllocation(
      [{ batchId: "b1", quantity: 5, expiryDate: new Date("2026-06-01") }],
      10,
    );
    expect(remaining).toBe(5);
  });
});

describe("movement reason rules", () => {
  it("requires reason for loss and inventory adjustment", () => {
    expect(requiresReason("SAIDA_PERDA")).toBe(true);
    expect(requiresReason("AJUSTE_INVENTARIO")).toBe(true);
    expect(requiresReason("SAIDA_CONSUMO")).toBe(false);
  });
});
