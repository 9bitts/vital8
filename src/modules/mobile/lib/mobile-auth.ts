import { auth } from "@/lib/auth/auth";
import { createTenantClient } from "@/lib/db/tenant-client";
import { hasOrgFeature } from "@/lib/features/subscription.service";
import { OFFLINE_ROLES } from "@/lib/offline/types";
import type { Role } from "@/generated/prisma/client";

export type MobileSession = {
  userId: string;
  organizationId: string;
  role: Role;
  db: ReturnType<typeof createTenantClient>;
};

export async function requireMobileSession(): Promise<MobileSession> {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId || !session.role) {
    throw new Response(JSON.stringify({ error: { message: "Não autenticado" } }), {
      status: 401,
    });
  }

  const pwaOk = await hasOrgFeature(session.organizationId, "pwa");
  if (!pwaOk) {
    throw new Response(
      JSON.stringify({ error: { message: "PWA disponível em planos PRO e ENTERPRISE" } }),
      { status: 403 },
    );
  }

  return {
    userId: session.user.id,
    organizationId: session.organizationId,
    role: session.role,
    db: createTenantClient(session.organizationId),
  };
}

export function canUseOffline(role: Role): boolean {
  return OFFLINE_ROLES.includes(role as (typeof OFFLINE_ROLES)[number]);
}
