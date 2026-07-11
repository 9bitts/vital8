import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@/generated/prisma/client";
import { authConfig } from "@/lib/auth/auth.config";
import { adminPrisma } from "@/lib/db/admin-client";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/modules/core/schemas/auth.schema";
import { createAuditLog } from "@/modules/core/services/audit.service";

async function resolveActiveMembership(userId: string, organizationId?: string) {
  const memberships = await adminPrisma.membership.findMany({
    where: {
      userId,
      isActive: true,
      deletedAt: null,
      organization: { isActive: true, deletedAt: null },
    },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) {
    return null;
  }

  if (organizationId) {
    const match = memberships.find((m) => m.organizationId === organizationId);
    if (match) return match;
  }

  return memberships[0];
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;
        const user = await adminPrisma.user.findFirst({
          where: { email: email.toLowerCase(), deletedAt: null },
        });

        if (!user?.passwordHash) {
          await createAuditLog({
            action: "user.login_failed",
            metadata: { email },
          });
          return null;
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          await createAuditLog({
            action: "user.login_failed",
            userId: user.id,
            metadata: { email },
          });
          return null;
        }

        const membership = await resolveActiveMembership(user.id);
        if (!membership) {
          return null;
        }

        await createAuditLog({
          action: "user.login",
          userId: user.id,
          organizationId: membership.organizationId,
          entityType: "User",
          entityId: user.id,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: membership.organizationId,
          role: membership.role,
        };
      },
    }),
  ],
});

export async function refreshSessionOrganization(
  userId: string,
  organizationId: string,
): Promise<{ organizationId: string; role: Role } | null> {
  const membership = await resolveActiveMembership(userId, organizationId);
  if (!membership) return null;

  return {
    organizationId: membership.organizationId,
    role: membership.role,
  };
}
