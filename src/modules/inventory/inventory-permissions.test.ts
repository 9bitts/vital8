import { describe, expect, it } from "vitest";
import {
  canAccessInventory,
  canAdjustInventory,
  canManageInventory,
  canViewControlledReport,
  isInventoryReadOnly,
} from "./lib/permissions";

describe("inventory permissions", () => {
  it("ESTOQUE can manage but not view controlled book", () => {
    expect(canManageInventory("ESTOQUE")).toBe(true);
    expect(canAdjustInventory("ESTOQUE")).toBe(true);
    expect(canViewControlledReport("ESTOQUE")).toBe(false);
  });

  it("RECEPCAO is read-only", () => {
    expect(canAccessInventory("RECEPCAO")).toBe(true);
    expect(isInventoryReadOnly("RECEPCAO")).toBe(true);
    expect(canManageInventory("RECEPCAO")).toBe(false);
  });

  it("OWNER can view controlled report", () => {
    expect(canViewControlledReport("OWNER")).toBe(true);
  });
});
