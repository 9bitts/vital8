import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@/generated/prisma/client";
import { authConfig } from "@/lib/auth/auth.config";
import {
  doctor8Provider,
  type Doctor8Profile,
  isDoctor8B2BRole,
} from "@/lib/auth/doctor8-provider";
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

function normalizeDocumentNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    doctor8Provider(),
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
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "doctor8") {
        return true;
      }

      const p = profile as Doctor8Profile | undefined;

      if (p?.email_verified !== true) {
        console.warn(
          "SSO doctor8 bloqueado: email não verificado, sub=",
          p?.sub,
        );
        return "/entrar?error=Doctor8EmailNaoVerificado";
      }

      if (!isDoctor8B2BRole(p?.role) || !p?.org_cnpj) {
        console.warn(
          "SSO doctor8 bloqueado: conta não B2B ou sem CNPJ, sub=",
          p?.sub,
        );
        return "/entrar?error=Doctor8ContaInvalida";
      }

      const email = p?.email?.toLowerCase();
      if (!email) {
        console.warn(
          "SSO doctor8 bloqueado: email ausente, sub=",
          p?.sub,
        );
        return "/entrar?error=Doctor8SemConta";
      }

      const user = await adminPrisma.user.findFirst({
        where: { email, deletedAt: null },
      });

      if (!user) {
        console.warn(
          "SSO doctor8 bloqueado: usuário não cadastrado, sub=",
          p?.sub,
        );
        return "/entrar?error=Doctor8SemConta";
      }

      const membership = await resolveActiveMembership(user.id);
      if (!membership) {
        console.warn(
          "SSO doctor8 bloqueado: sem membership ativo, sub=",
          p?.sub,
        );
        return "/entrar?error=Doctor8SemOrganizacao";
      }

      const organization = await adminPrisma.organization.findFirst({
        where: {
          id: membership.organizationId,
          deletedAt: null,
        },
        select: { documentNumber: true },
      });

      if (
        !organization ||
        normalizeDocumentNumber(organization.documentNumber) !==
          normalizeDocumentNumber(p.org_cnpj)
      ) {
        console.warn(
          "SSO doctor8 bloqueado: CNPJ divergente, sub=",
          p?.sub,
        );
        return "/entrar?error=Doctor8CnpjDivergente";
      }

      await createAuditLog({
        action: "user.login",
        userId: user.id,
        organizationId: membership.organizationId,
        metadata: {
          sso: "doctor8",
          orgType: p.org_type,
          cnpj: p.org_cnpj,
        },
      });

      return true;
    },
    async jwt({ token, user, account, profile, trigger, session }) {
      if (user && account?.provider === "doctor8") {
        const p = profile as Doctor8Profile | undefined;
        const email = (p?.email ?? user.email)?.toLowerCase();
        if (!email) {
          throw new Error("doctor8 SSO: email ausente no jwt");
        }

        const vital8User = await adminPrisma.user.findFirst({
          where: { email, deletedAt: null },
        });
        if (!vital8User) {
          throw new Error("doctor8 SSO: usuário não encontrado");
        }

        const membership = await resolveActiveMembership(vital8User.id);
        if (!membership) {
          throw new Error("doctor8 SSO: sem membership ativo");
        }

        token.id = vital8User.id;
        token.name = vital8User.name;
        token.organizationId = membership.organizationId;
        token.role = membership.role;
        token.branchId = null;
      } else if (user) {
        token.id = user.id;
        token.name = user.name;
        token.organizationId = user.organizationId;
        token.role = user.role;
        token.branchId = user.branchId ?? null;
      }

      if (trigger === "update" && session) {
        const updateSession = session as {
          organizationId?: string;
          role?: Role;
          branchId?: string | null;
        };

        if (updateSession.organizationId && updateSession.role) {
          token.organizationId = updateSession.organizationId;
          token.role = updateSession.role;
        }
        if (updateSession.branchId !== undefined) {
          token.branchId = updateSession.branchId;
        }
      }

      return token;
    },
  },
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
