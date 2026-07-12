import type { PermissionKey } from "@/lib/auth/permissions";
import type { Role } from "@/generated/prisma/client";
import { headers } from "next/headers";
import type { Role as RoleType } from "@/generated/prisma/client";
import { auth } from "@/lib/auth/auth";
import { createTenantClient } from "@/lib/db/tenant-client";
import { canUser } from "@/modules/admin/services/permission-profile.service";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: "UNAUTHORIZED" | "FORBIDDEN" | "NO_ORGANIZATION" | "READ_ONLY",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export type AuthContext = {
  userId: string;
  userEmail: string;
  userName: string;
  organizationId: string;
  branchId: string | null;
  role: Role;
  db: ReturnType<typeof createTenantClient>;
};

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export function mapAuthError(error: unknown): ActionResult {
  if (error instanceof AuthError) {
    return { success: false, error: error.message };
  }
  return { success: false, error: "Erro inesperado" };
}

export async function requireAuth(
  allowedRoles?: RoleType[],
): Promise<AuthContext> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AuthError("Não autenticado", "UNAUTHORIZED");
  }

  if (!session.organizationId || !session.role) {
    throw new AuthError("Organização ativa não definida", "NO_ORGANIZATION");
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    throw new AuthError("Permissão insuficiente", "FORBIDDEN");
  }

  return {
    userId: session.user.id,
    userEmail: session.user.email ?? "",
    userName: session.user.name ?? "",
    organizationId: session.organizationId,
    branchId: session.branchId ?? null,
    role: session.role,
    db: createTenantClient(session.organizationId),
  };
}

export async function requirePermission(
  ctx: AuthContext,
  key: PermissionKey,
): Promise<void> {
  const ok = await canUser(ctx.organizationId, ctx.userId, ctx.role, key);
  if (!ok) {
    throw new AuthError("Permissão insuficiente", "FORBIDDEN");
  }
}

export async function can(ctx: AuthContext, key: PermissionKey): Promise<boolean> {
  return canUser(ctx.organizationId, ctx.userId, ctx.role, key);
}

export function branchScope(branchId: string | null | undefined) {
  if (!branchId) return {};
  return { branchId };
}

export async function getRequestMeta(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  const headerList = await headers();
  return {
    ipAddress:
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerList.get("x-real-ip") ??
      null,
    userAgent: headerList.get("user-agent"),
  };
}
