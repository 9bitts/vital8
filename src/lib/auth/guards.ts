import { headers } from "next/headers";
import type { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth/auth";
import { createTenantClient } from "@/lib/db/tenant-client";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: "UNAUTHORIZED" | "FORBIDDEN" | "NO_ORGANIZATION",
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
  allowedRoles?: Role[],
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
    role: session.role,
    db: createTenantClient(session.organizationId),
  };
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
