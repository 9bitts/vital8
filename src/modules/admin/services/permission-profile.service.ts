import type { PermissionKey, PermissionLimits, PermissionMatrix } from "@/lib/auth/permissions";
import { checkPermission, DEFAULT_PROFILES, getLimits } from "@/lib/auth/permissions";
import type { Role } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";

export async function getMembershipPermissions(
  organizationId: string,
  userId: string,
  role: Role,
): Promise<{ matrix: PermissionMatrix; limits: PermissionLimits }> {
  const membership = await adminPrisma.membership.findFirst({
    where: { organizationId, userId, isActive: true },
    include: { permissionProfile: true },
  });

  const profilePerms = (membership?.permissionProfile?.permissions ?? {}) as PermissionMatrix;
  const profileLimits = (membership?.permissionProfile?.limits ?? {}) as PermissionLimits;

  return {
    matrix: { ...DEFAULT_PROFILES[role].permissions, ...profilePerms },
    limits: getLimits(profileLimits, role),
  };
}

export async function canUser(
  organizationId: string,
  userId: string,
  role: Role,
  key: PermissionKey,
): Promise<boolean> {
  const { matrix } = await getMembershipPermissions(organizationId, userId, role);
  return checkPermission(matrix, key, role);
}

export async function seedDefaultProfiles(organizationId: string) {
  for (const [role, def] of Object.entries(DEFAULT_PROFILES)) {
    await adminPrisma.permissionProfile.upsert({
      where: { organizationId_name: { organizationId, name: def.name } },
      create: {
        organizationId,
        name: def.name,
        roleTemplate: role as Role,
        permissions: def.permissions,
        limits: def.limits,
        isDefault: true,
      },
      update: {
        permissions: def.permissions,
        limits: def.limits,
        isDefault: true,
      },
    });
  }
}

export async function assignDefaultProfile(membershipId: string, role: Role, organizationId: string) {
  const def = DEFAULT_PROFILES[role];
  const profile = await adminPrisma.permissionProfile.findFirst({
    where: { organizationId, name: def.name },
  });
  if (profile) {
    await adminPrisma.membership.update({
      where: { id: membershipId },
      data: { permissionProfileId: profile.id },
    });
  }
}
