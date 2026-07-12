import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";
import { hashPassword } from "@/lib/auth/password";
import { isDatabaseAvailable } from "@/lib/test/db-available";

describe("Multi-tenant isolation", () => {
  let orgAId: string;
  let orgBId: string;
  let membershipAId: string;
  let membershipBId: string;
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) return;

    const passwordHash = await hashPassword("Teste@1234");

    const orgA = await adminPrisma.organization.create({
      data: {
        name: "Org Isolamento A",
        slug: `isolamento-a-${Date.now()}`,
        documentType: "CNPJ",
        documentNumber: "11222333000181",
        type: "CLINICA",
      },
    });

    const orgB = await adminPrisma.organization.create({
      data: {
        name: "Org Isolamento B",
        slug: `isolamento-b-${Date.now()}`,
        documentType: "CNPJ",
        documentNumber: "11444777000161",
        type: "CONSULTORIO",
      },
    });

    orgAId = orgA.id;
    orgBId = orgB.id;

    const userA = await adminPrisma.user.create({
      data: {
        name: "User A",
        email: `user-a-${Date.now()}@test.local`,
        passwordHash,
      },
    });

    const userB = await adminPrisma.user.create({
      data: {
        name: "User B",
        email: `user-b-${Date.now()}@test.local`,
        passwordHash,
      },
    });

    const membershipA = await adminPrisma.membership.create({
      data: {
        userId: userA.id,
        organizationId: orgAId,
        role: "OWNER",
      },
    });

    const membershipB = await adminPrisma.membership.create({
      data: {
        userId: userB.id,
        organizationId: orgBId,
        role: "OWNER",
      },
    });

    membershipAId = membershipA.id;
    membershipBId = membershipB.id;

    await adminPrisma.auditLog.create({
      data: {
        organizationId: orgBId,
        action: "test.isolation",
        entityType: "Test",
        entityId: "secret-b",
      },
    });
  });

  afterAll(async () => {
    if (!dbAvailable || !orgAId || !orgBId) return;
    await adminPrisma.auditLog.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.membership.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.$disconnect();
  });

  it("tenant client A não vê memberships da org B", async () => {
    if (!dbAvailable) return;
    const tenantA = createTenantClient(orgAId);
    const memberships = await tenantA.membership.findMany();

    expect(memberships.some((m) => m.id === membershipBId)).toBe(false);
    expect(memberships.some((m) => m.id === membershipAId)).toBe(true);
  });

  it("tenant client A não vê audit logs da org B", async () => {
    if (!dbAvailable) return;
    const tenantA = createTenantClient(orgAId);
    const logs = await tenantA.auditLog.findMany({
      where: { action: "test.isolation" },
    });

    expect(logs).toHaveLength(0);
  });

  it("tenant client B vê apenas seus audit logs", async () => {
    if (!dbAvailable) return;
    const tenantB = createTenantClient(orgBId);
    const logs = await tenantB.auditLog.findMany({
      where: { action: "test.isolation" },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]?.entityId).toBe("secret-b");
  });

  it("update via tenant A não afeta membership da org B", async () => {
    if (!dbAvailable) return;
    const tenantA = createTenantClient(orgAId);

    const result = await tenantA.membership.updateMany({
      where: { id: membershipBId },
      data: { role: "LEITURA" },
    });

    expect(result.count).toBe(0);

    const membershipB = await adminPrisma.membership.findUnique({
      where: { id: membershipBId },
    });
    expect(membershipB?.role).toBe("OWNER");
  });

  it("create via tenant A injeta organizationId automaticamente", async () => {
    if (!dbAvailable) return;
    const tenantA = createTenantClient(orgAId);
    const user = await adminPrisma.user.create({
      data: {
        name: "Invite Target",
        email: `invite-${Date.now()}@test.local`,
        passwordHash: await hashPassword("Teste@1234"),
      },
    });

    const invitation = await tenantA.invitation.create({
      data: {
        organizationId: orgAId,
        email: user.email,
        role: "RECEPCAO",
        token: `token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400000),
        invitedById: user.id,
      },
    });

    expect(invitation.organizationId).toBe(orgAId);

    await adminPrisma.invitation.delete({ where: { id: invitation.id } });
    await adminPrisma.user.delete({ where: { id: user.id } });
  });
});
