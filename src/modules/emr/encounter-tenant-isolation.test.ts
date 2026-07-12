import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";
import { encryptPHI } from "@/lib/crypto/phi";
import { hashCpf, normalizeSearchName } from "@/lib/crypto/search-hash";
import { isDatabaseAvailable } from "@/lib/test/db-available";

describe("Encounter tenant isolation", () => {
  let orgAId: string;
  let orgBId: string;
  let encounterAId: string;
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) return;

    const orgA = await adminPrisma.organization.create({
      data: {
        name: "Org EMR A",
        slug: `emr-a-${Date.now()}`,
        documentType: "CNPJ",
        documentNumber: "11222333000181",
        type: "CLINICA",
      },
    });
    const orgB = await adminPrisma.organization.create({
      data: {
        name: "Org EMR B",
        slug: `emr-b-${Date.now()}`,
        documentType: "CNPJ",
        documentNumber: "11444777000161",
        type: "CLINICA",
      },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const tenantA = createTenantClient(orgAId);
    const tenantB = createTenantClient(orgBId);

    const patientA = await tenantA.patient.create({
      data: {
        organizationId: orgAId,
        searchName: normalizeSearchName("Pac EMR A"),
        fullName: "Pac EMR A",
        cpfHash: hashCpf("52998224725", orgAId),
        cpfEncrypted: encryptPHI("52998224725"),
      },
    });

    const profA = await tenantA.professional.create({
      data: { organizationId: orgAId, displayName: "Dr A" },
    });

    const encA = await tenantA.encounter.create({
      data: {
        organizationId: orgAId,
        patientId: patientA.id,
        professionalId: profA.id,
        authorUserId: "user-a",
      },
    });
    encounterAId = encA.id;

    const patientB = await tenantB.patient.create({
      data: {
        organizationId: orgBId,
        searchName: normalizeSearchName("Pac EMR B"),
        fullName: "Pac EMR B",
        cpfHash: hashCpf("39053344705", orgBId),
        cpfEncrypted: encryptPHI("39053344705"),
      },
    });

    const profB = await tenantB.professional.create({
      data: { organizationId: orgBId, displayName: "Dr B" },
    });

    await tenantB.encounter.create({
      data: {
        organizationId: orgBId,
        patientId: patientB.id,
        professionalId: profB.id,
        authorUserId: "user-b",
      },
    });
  });

  afterAll(async () => {
    if (!dbAvailable || !orgAId || !orgBId) return;
    await adminPrisma.encounter.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.professional.deleteMany({
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

  it("tenant B não vê encontro da org A", async () => {
    if (!dbAvailable) return;
    const tenantB = createTenantClient(orgBId);
    const found = await tenantB.encounter.findFirst({
      where: { id: encounterAId },
    });
    expect(found).toBeNull();
  });
});
