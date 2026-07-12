import { describe, expect, it, vi, beforeEach } from "vitest";

const { allergyFindMany, drugInteractionFindFirst } = vi.hoisted(() => ({
  allergyFindMany: vi.fn(),
  drugInteractionFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/admin-client", () => ({
  adminPrisma: {
    drugCatalog: { findMany: vi.fn().mockResolvedValue([]) },
    drugInteraction: { findFirst: drugInteractionFindFirst },
  },
}));

vi.mock("./prescription-settings.service", () => ({
  getOrCreatePrescriptionSettings: vi.fn().mockResolvedValue({
    blockOnAllergyConflict: true,
    blockOnDrugInteraction: true,
  }),
}));

import type { TenantClient } from "@/lib/db/tenant-client";
import { checkPrescriptionSafety } from "./prescription-safety.service";

const mockDb = {
  allergy: { findMany: allergyFindMany },
} as unknown as TenantClient;

describe("checkPrescriptionSafety", () => {
  beforeEach(() => {
    allergyFindMany.mockReset();
    drugInteractionFindFirst.mockReset();
  });

  it("flags allergy conflict as blocking when configured", async () => {
    allergyFindMany.mockResolvedValue([{ substance: "dipirona" }]);
    drugInteractionFindFirst.mockResolvedValue(null);

    const result = await checkPrescriptionSafety(
      mockDb,
      "org1",
      "pat1",
      [{ drugName: "Dipirona 500mg", dosage: "8/8h" }],
    );

    expect(result.blocking).toBe(true);
    expect(result.alerts.some((a) => a.type === "ALLERGY")).toBe(true);
  });

  it("flags drug interaction severity", async () => {
    allergyFindMany.mockResolvedValue([]);
    drugInteractionFindFirst.mockResolvedValue({
      severity: "BLOCKING",
      description: "Contraindicado",
    });

    const result = await checkPrescriptionSafety(mockDb, "org1", "pat1", [
      { drugName: "Tramadol", dosage: "50mg" },
      { drugName: "Fluoxetina", dosage: "20mg" },
    ]);

    expect(result.alerts.some((a) => a.type === "INTERACTION")).toBe(true);
    expect(result.blocking).toBe(true);
  });
});
