import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";
import { encryptPHI } from "@/lib/crypto/phi";
import { hashCpf, normalizeSearchName } from "@/lib/crypto/search-hash";
import { isDatabaseAvailable } from "@/lib/test/db-available";

describe("Sale tenant isolation", () => {
  let orgAId: string;
  let orgBId: string;
  let saleAId: string;
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) return;

    const orgA = await adminPrisma.organization.create({
      data: {
        name: "Org Fin A",
        slug: `fin-a-${Date.now()}`,
        documentType: "CNPJ",
        documentNumber: "11222333000181",
        type: "CLINICA",
      },
    });
    const orgB = await adminPrisma.organization.create({
      data: {
        name: "Org Fin B",
        slug: `fin-b-${Date.now()}`,
        documentType: "CNPJ",
        documentNumber: "11444777000161",
        type: "CLINICA",
      },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const tenantA = createTenantClient(orgAId);
    const patientA = await tenantA.patient.create({
      data: {
        organizationId: orgAId,
        searchName: normalizeSearchName("Pac Fin A"),
        fullName: "Pac Fin A",
        cpfHash: hashCpf("52998224725", orgAId),
        cpfEncrypted: encryptPHI("52998224725"),
      },
    });

    const saleA = await tenantA.sale.create({
      data: {
        organizationId: orgAId,
        patientId: patientA.id,
        status: "CONFIRMADA",
        subtotalCents: 10000,
        totalCents: 10000,
        createdByUserId: "u1",
      },
    });
    saleAId = saleA.id;

    const tenantB = createTenantClient(orgBId);
    const patientB = await tenantB.patient.create({
      data: {
        organizationId: orgBId,
        searchName: normalizeSearchName("Pac Fin B"),
        fullName: "Pac Fin B",
        cpfHash: hashCpf("39053344705", orgBId),
        cpfEncrypted: encryptPHI("39053344705"),
      },
    });

    await tenantB.sale.create({
      data: {
        organizationId: orgBId,
        patientId: patientB.id,
        status: "CONFIRMADA",
        subtotalCents: 20000,
        totalCents: 20000,
        createdByUserId: "u2",
      },
    });
  });

  afterAll(async () => {
    if (!dbAvailable || !orgAId || !orgBId) return;
    await adminPrisma.sale.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.patient.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.$disconnect();
  });

  it("tenant B não vê venda da org A", async () => {
    if (!dbAvailable) return;
    const tenantB = createTenantClient(orgBId);
    const found = await tenantB.sale.findFirst({ where: { id: saleAId } });
    expect(found).toBeNull();
  });
});
