import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";
import { nextSequenceNumber } from "@/lib/tiss/sequence";
import { isDatabaseAvailable } from "@/lib/test/db-available";

describe("TISS sequence concurrency", () => {
  let dbAvailable = false;
  let orgId = "";
  let insurerId = "";

  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) return;

    const org = await adminPrisma.organization.create({
      data: {
        name: "TISS Seq Test",
        slug: `tiss-seq-${Date.now()}`,
        documentType: "CNPJ",
        documentNumber: "11222333000181",
        type: "CLINICA",
        plan: "ENTERPRISE",
      },
    });
    orgId = org.id;

    const insurer = await adminPrisma.healthInsurer.create({
      data: {
        organizationId: org.id,
        name: "Test Insurer",
        ansRegistration: `T${Date.now()}`,
        cnpj: "00000000000191",
      },
    });
    insurerId = insurer.id;
  });

  afterAll(async () => {
    if (!dbAvailable || !orgId) return;
    await adminPrisma.tissSequence.deleteMany({ where: { organizationId: orgId } });
    await adminPrisma.healthInsurer.deleteMany({ where: { organizationId: orgId } });
    await adminPrisma.organization.delete({ where: { id: orgId } });
  });

  it("increments guide numbers without collision per org+insurer", async () => {
    if (!dbAvailable) return;

    const db = createTenantClient(orgId);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        nextSequenceNumber(db, orgId, insurerId, "GUIDE"),
      ),
    );

    expect(new Set(results).size).toBe(5);
    expect(Math.min(...results)).toBe(1);
    expect(Math.max(...results)).toBe(5);
  });
});
