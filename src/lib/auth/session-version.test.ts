import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { adminPrisma } from "@/lib/db/admin-client";
import { isDatabaseAvailable } from "@/lib/test/db-available";
import {
  getSessionVersions,
  incrementMembershipSessionVersion,
} from "@/lib/auth/session-version.service";

describe("JWT sessionVersion revocation", () => {
  let dbAvailable = false;
  let userId: string;
  let orgId: string;

  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) return;

    const ts = Date.now();
    const org = await adminPrisma.organization.create({
      data: {
        name: "Session Test Org",
        slug: `session-test-${ts}`,
        documentType: "CNPJ",
        documentNumber: "11222333000199",
        type: "CLINICA",
      },
    });
    orgId = org.id;

    const user = await adminPrisma.user.create({
      data: {
        name: "Session User",
        email: `session-${ts}@test.local`,
        passwordHash: "hash",
      },
    });
    userId = user.id;

    await adminPrisma.membership.create({
      data: {
        userId,
        organizationId: orgId,
        role: "ADMIN",
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await adminPrisma.membership.deleteMany({ where: { userId } });
    await adminPrisma.user.delete({ where: { id: userId } });
    await adminPrisma.organization.delete({ where: { id: orgId } });
  });

  it("invalidates session after membership deactivation", async () => {
    if (!dbAvailable) return;

    const before = await getSessionVersions(userId, orgId);
    expect(before).not.toBeNull();
    const tokenUserVersion = before!.userSessionVersion;
    const tokenMembershipVersion = before!.membershipSessionVersion;

    await adminPrisma.membership.update({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      data: { isActive: false },
    });
    await incrementMembershipSessionVersion(userId, orgId);

    const after = await getSessionVersions(userId, orgId);
    expect(after).toBeNull();

    await adminPrisma.membership.update({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      data: { isActive: true, sessionVersion: tokenMembershipVersion + 1 },
    });

    const restored = await getSessionVersions(userId, orgId);
    expect(restored?.membershipSessionVersion).toBeGreaterThan(tokenMembershipVersion);
    expect(restored?.userSessionVersion).toBe(tokenUserVersion);
  });
});
