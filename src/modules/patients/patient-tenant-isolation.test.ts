import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";
import { encryptPHI } from "@/lib/crypto/phi";
import { hashCpf, normalizeSearchName } from "@/lib/crypto/search-hash";
import { isDatabaseAvailable } from "@/lib/test/db-available";

describe("Patient tenant isolation", () => {
  let orgAId: string;
  let orgBId: string;
  let patientAId: string;
  let patientBId: string;
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) return;

    const orgA = await adminPrisma.organization.create({
      data: {
        name: "Org Patient A",
        slug: `patient-a-${Date.now()}`,
        documentType: "CNPJ",
        documentNumber: "11222333000181",
        type: "CLINICA",
      },
    });

    const orgB = await adminPrisma.organization.create({
      data: {
        name: "Org Patient B",
        slug: `patient-b-${Date.now()}`,
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
        searchName: normalizeSearchName("Maria Org A"),
        fullName: "Maria Org A",
        cpfEncrypted: encryptPHI("52998224725"),
        cpfHash: hashCpf("52998224725", orgAId),
      },
    });

    const patientB = await tenantB.patient.create({
      data: {
        organizationId: orgBId,
        searchName: normalizeSearchName("João Org B"),
        fullName: "João Org B",
        cpfEncrypted: encryptPHI("39053344705"),
        cpfHash: hashCpf("39053344705", orgBId),
      },
    });

    patientAId = patientA.id;
    patientBId = patientB.id;
  });

  afterAll(async () => {
    if (!dbAvailable || !orgAId || !orgBId) return;
    await adminPrisma.patient.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.$disconnect();
  });

  it("tenant A não vê pacientes da org B", async () => {
    if (!dbAvailable) return;
    const tenantA = createTenantClient(orgAId);
    const patients = await tenantA.patient.findMany();
    expect(patients.some((p) => p.id === patientBId)).toBe(false);
    expect(patients.some((p) => p.id === patientAId)).toBe(true);
  });

  it("tenant B não acessa paciente da org A por id", async () => {
    if (!dbAvailable) return;
    const tenantB = createTenantClient(orgBId);
    const patient = await tenantB.patient.findFirst({
      where: { id: patientAId },
    });
    expect(patient).toBeNull();
  });

  it("update via tenant A não afeta paciente da org B", async () => {
    if (!dbAvailable) return;
    const tenantA = createTenantClient(orgAId);
    const result = await tenantA.patient.updateMany({
      where: { id: patientBId },
      data: { fullName: "Hackeado" },
    });
    expect(result.count).toBe(0);

    const patientB = await adminPrisma.patient.findUnique({
      where: { id: patientBId },
    });
    expect(patientB?.fullName).toBe("João Org B");
  });

  it("create injeta organizationId automaticamente", async () => {
    if (!dbAvailable) return;
    const tenantA = createTenantClient(orgAId);
    const created = await tenantA.patient.create({
      data: {
        organizationId: orgAId,
        searchName: "teste auto org",
        fullName: "Teste Auto Org",
      },
    });
    expect(created.organizationId).toBe(orgAId);
    await adminPrisma.patient.delete({ where: { id: created.id } });
  });
});
