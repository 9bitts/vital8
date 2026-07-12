import { adminPrisma } from "@/lib/db/admin-client";

export async function getSessionVersions(userId: string, organizationId: string) {
  const [user, membership] = await Promise.all([
    adminPrisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { sessionVersion: true },
    }),
    adminPrisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        deletedAt: null,
      },
      select: { sessionVersion: true, isActive: true, role: true },
    }),
  ]);

  if (!user || !membership?.isActive) {
    return null;
  }

  return {
    userSessionVersion: user.sessionVersion,
    membershipSessionVersion: membership.sessionVersion,
    role: membership.role,
  };
}

export async function incrementUserSessionVersion(userId: string) {
  return adminPrisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
}

export async function incrementMembershipSessionVersion(
  userId: string,
  organizationId: string,
) {
  return adminPrisma.membership.update({
    where: {
      userId_organizationId: { userId, organizationId },
    },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
}
