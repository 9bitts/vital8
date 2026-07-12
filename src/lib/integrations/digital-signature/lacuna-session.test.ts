import { describe, expect, it } from "vitest";
import { isTenantScopedModel } from "@/lib/db/tenant-client";

describe("LacunaSignatureSession tenant isolation", () => {
  it("está na lista de models com organizationId", () => {
    expect(isTenantScopedModel("LacunaSignatureSession")).toBe(true);
  });
});
