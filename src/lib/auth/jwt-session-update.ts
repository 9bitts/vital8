import type { Role } from "@/generated/prisma/client";
import type { JWT } from "@auth/core/jwt";

export type SessionUpdatePayload = {
  organizationId?: string;
  role?: Role;
  branchId?: string | null;
};

export type MembershipResolver = (
  userId: string,
  organizationId?: string,
) => Promise<{ organizationId: string; role: Role } | null>;

export type BranchValidator = (
  branchId: string,
  organizationId: string,
) => Promise<boolean>;

export async function applyValidatedSessionUpdate(
  token: JWT,
  update: SessionUpdatePayload,
  deps: {
    resolveMembership: MembershipResolver;
    validateBranch: BranchValidator;
  },
): Promise<JWT> {
  const next: JWT = { ...token };

  if (update.organizationId) {
    const userId = token.id as string | undefined;
    if (!userId) {
      return token;
    }

    const membership = await deps.resolveMembership(
      userId,
      update.organizationId,
    );
    if (!membership) {
      return token;
    }

    next.organizationId = membership.organizationId;
    next.role = membership.role;
    if (update.branchId === undefined) {
      next.branchId = null;
    }
  }

  if (update.branchId !== undefined) {
    if (update.branchId === null) {
      next.branchId = null;
    } else {
      const orgId = (next.organizationId ?? token.organizationId) as
        | string
        | undefined;
      if (
        orgId &&
        (await deps.validateBranch(update.branchId, orgId))
      ) {
        next.branchId = update.branchId;
      }
    }
  }

  return next;
}
