import type { Prisma } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";

export async function listAccessibleBranches(
  organizationId: string,
  membershipId: string,
  branchAccessAll: boolean,
) {
  if (branchAccessAll) {
    return adminPrisma.branch.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ isMain: "desc" }, { name: "asc" }],
    });
  }
  return adminPrisma.branch.findMany({
    where: {
      organizationId,
      isActive: true,
      membershipBranches: { some: { membershipId } },
    },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
  });
}

export async function getMainBranch(organizationId: string) {
  return adminPrisma.branch.findFirst({
    where: { organizationId, isMain: true, isActive: true },
  });
}

export async function ensureMainBranch(organizationId: string) {
  const existing = await getMainBranch(organizationId);
  if (existing) return existing;
  return adminPrisma.branch.create({
    data: {
      id: `branch-main-${organizationId}`,
      organizationId,
      name: "Unidade Principal",
      isMain: true,
    },
  });
}

export async function assertBranchBelongsToOrg(
  organizationId: string,
  branchId: string,
): Promise<void> {
  const branch = await adminPrisma.branch.findFirst({
    where: { id: branchId, organizationId, isActive: true },
  });
  if (!branch) {
    throw new Error("Unidade inválida ou não pertence à organização");
  }
}

export function branchFilter(branchId: string | null | undefined) {
  if (!branchId) return {};
  return { branchId };
}

export async function createBranch(input: {
  organizationId: string;
  name: string;
  address?: Record<string, unknown>;
  cnes?: string;
  documentNumber?: string;
}) {
  return adminPrisma.branch.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      address: (input.address ?? {}) as Prisma.InputJsonValue,
      cnes: input.cnes,
      documentNumber: input.documentNumber,
    },
  });
}
