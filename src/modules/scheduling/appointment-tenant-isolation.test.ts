import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";
import { encryptPHI } from "@/lib/crypto/phi";
import { hashCpf, normalizeSearchName } from "@/lib/crypto/search-hash";
import { isDatabaseAvailable } from "@/lib/test/db-available";

describe("Appointment tenant isolation", () => {
  let orgAId: string;
  let orgBId: string;
  let patientAId: string;
  let patientBId: string;
  let profAId: string;
  let profBId: string;
  let serviceAId: string;
  let serviceBId: string;
  let apptAId: string;
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) return;

    const orgA = await adminPrisma.organization.create({
      data: {
        name: "Org Appt A",
        slug: `appt-a-${Date.now()}`,
        documentType: "CNPJ",
        documentNumber: "11222333000181",
        type: "CLINICA",
      },
    });

    const orgB = await adminPrisma.organization.create({
      data: {
        name: "Org Appt B",
        slug: `appt-b-${Date.now()}`,
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
        searchName: normalizeSearchName("Maria Appt A"),
        fullName: "Maria Appt A",
        cpfEncrypted: encryptPHI("52998224725"),
        cpfHash: hashCpf("52998224725", orgAId),
      },
    });

    const patientB = await tenantB.patient.create({
      data: {
        organizationId: orgBId,
        searchName: normalizeSearchName("João Appt B"),
        fullName: "João Appt B",
        cpfEncrypted: encryptPHI("39053344705"),
        cpfHash: hashCpf("39053344705", orgBId),
      },
    });

    patientAId = patientA.id;
    patientBId = patientB.id;

    const profA = await tenantA.professional.create({
      data: { organizationId: orgAId, displayName: "Dr A" },
    });
    const profB = await tenantB.professional.create({
      data: { organizationId: orgBId, displayName: "Dr B" },
    });
    profAId = profA.id;
    profBId = profB.id;

    const serviceA = await tenantA.service.create({
      data: {
        organizationId: orgAId,
        name: "Consulta A",
        durationMinutes: 30,
        privatePrice: 100,
      },
    });
    const serviceB = await tenantB.service.create({
      data: {
        organizationId: orgBId,
        name: "Consulta B",
        durationMinutes: 30,
        privatePrice: 100,
      },
    });
    serviceAId = serviceA.id;
    serviceBId = serviceB.id;

    const startsAt = new Date("2026-08-01T10:00:00");
    const apptA = await tenantA.appointment.create({
      data: {
        organizationId: orgAId,
        patientId: patientAId,
        professionalId: profAId,
        serviceId: serviceAId,
        startsAt,
        endsAt: new Date("2026-08-01T10:30:00"),
      },
    });
    apptAId = apptA.id;

    await tenantB.appointment.create({
      data: {
        organizationId: orgBId,
        patientId: patientBId,
        professionalId: profBId,
        serviceId: serviceBId,
        startsAt,
        endsAt: new Date("2026-08-01T10:30:00"),
      },
    });
  });

  afterAll(async () => {
    if (!dbAvailable || !orgAId || !orgBId) return;
    await adminPrisma.appointment.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.service.deleteMany({
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

  it("tenant A não vê agendamentos da org B", async () => {
    if (!dbAvailable) return;
    const tenantA = createTenantClient(orgAId);
    const appts = await tenantA.appointment.findMany();
    expect(appts.some((a) => a.patientId === patientBId)).toBe(false);
    expect(appts.some((a) => a.id === apptAId)).toBe(true);
  });

  it("tenant B não acessa agendamento da org A por id", async () => {
    if (!dbAvailable) return;
    const tenantB = createTenantClient(orgBId);
    const appt = await tenantB.appointment.findFirst({
      where: { id: apptAId },
    });
    expect(appt).toBeNull();
  });
});
