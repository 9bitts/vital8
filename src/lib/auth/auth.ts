import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import type { Role } from "@/generated/prisma/client";
import { authConfig } from "@/lib/auth/auth.config";
import {
  doctor8Provider,
  type Doctor8Profile,
  isDoctor8B2BRole,
} from "@/lib/auth/doctor8-provider";
import {
  applyValidatedSessionUpdate,
  type SessionUpdatePayload,
} from "@/lib/auth/jwt-session-update";
import { adminPrisma } from "@/lib/db/admin-client";
import { verifyPassword } from "@/lib/auth/password";
import { isValidCnpj, stripCnpj } from "@/lib/cnpj";
import { checkLoginRateLimit } from "@/lib/security/login-rate-limit";
import { slugify } from "@/lib/utils";
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

async function getActiveMembershipsWithOrg(userId: string) {
  return adminPrisma.membership.findMany({
    where: {
      userId,
      isActive: true,
      deletedAt: null,
      organization: { isActive: true, deletedAt: null },
    },
    include: {
      organization: {
        select: { documentNumber: true },
      },
    },
  });
}

function findMembershipByCnpj(
  memberships: Awaited<ReturnType<typeof getActiveMembershipsWithOrg>>,
  orgCnpj: string,
) {
  const normalized = normalizeDocumentNumber(orgCnpj);
  return (
    memberships.find(
      (m) =>
        normalizeDocumentNumber(m.organization.documentNumber) === normalized,
    ) ?? null
  );
}

async function validateBranchForOrganization(
  branchId: string,
  organizationId: string,
): Promise<boolean> {
  const branch = await adminPrisma.branch.findFirst({
    where: { id: branchId, organizationId, isActive: true },
    select: { id: true },
  });
  return !!branch;
}

async function uniqueOrgSlug(base: string): Promise<string> {
  const slug = slugify(base);
  let suffix = 0;

  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const existing = await adminPrisma.organization.findUnique({
      where: { slug: candidate },
    });
    if (!existing) return candidate;
    suffix += 1;
  }
}

function mapDoctor8MemberRoleToVital8(
  orgMemberRole: string | null | undefined,
): Role | null {
  if (orgMemberRole === "OWNER") return "OWNER";
  if (orgMemberRole === "ADMIN") return "ADMIN";
  return null;
}

async function provisionClinicFromDoctor8(
  profile: Doctor8Profile,
  email: string,
): Promise<{ userId: string; organizationId: string } | null> {
  if (profile.org_type !== "CLINIC" || !profile.org_cnpj) {
    return null;
  }

  const cnpj = stripCnpj(profile.org_cnpj);
  if (!isValidCnpj(cnpj)) {
    return null;
  }

  const orgName = profile.org_name?.trim() || profile.org_razao_social?.trim();
  if (!orgName) {
    return null;
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const existingUser = await adminPrisma.user.findFirst({
    where: { email, deletedAt: null },
  });

  if (existingUser) {
    const vital8Role = mapDoctor8MemberRoleToVital8(profile.org_member_role);
    if (!vital8Role) {
      return null;
    }

    const existingOrg = await adminPrisma.organization.findFirst({
      where: {
        documentNumber: cnpj,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existingOrg) {
      return null;
    }

    const slug = await uniqueOrgSlug(orgName);
    const organization = await adminPrisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          type: "CLINICA",
          documentType: "CNPJ",
          documentNumber: cnpj,
          email,
          trialEndsAt,
        },
      });

      await tx.membership.create({
        data: {
          userId: existingUser.id,
          organizationId: org.id,
          role: vital8Role,
        },
      });

      return org;
    });

    await createAuditLog({
      action: "user.provisioned_from_doctor8",
      userId: existingUser.id,
      organizationId: organization.id,
      metadata: { sso: "doctor8", cnpj, orgMemberRole: profile.org_member_role },
    });

    return { userId: existingUser.id, organizationId: organization.id };
  }

  const slug = await uniqueOrgSlug(orgName);
  const result = await adminPrisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: profile.name?.trim() || orgName,
        email,
      },
    });

    const organization = await tx.organization.create({
      data: {
        name: orgName,
        slug,
        type: "CLINICA",
        documentType: "CNPJ",
        documentNumber: cnpj,
        email,
        trialEndsAt,
      },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: "OWNER",
      },
    });

    return { user, organization };
  });

  await createAuditLog({
    action: "user.provisioned_from_doctor8",
    userId: result.user.id,
    organizationId: result.organization.id,
    metadata: { sso: "doctor8", cnpj, createdUser: true },
  });

  return {
    userId: result.user.id,
    organizationId: result.organization.id,
  };
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
        const normalizedEmail = email.toLowerCase();

        const headerList = await headers();
        const ip =
          headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          headerList.get("x-real-ip") ??
          "unknown";
        const limit = checkLoginRateLimit(normalizedEmail, ip);
        if (!limit.allowed) {
          return null;
        }

        const user = await adminPrisma.user.findFirst({
          where: { email: normalizedEmail, deletedAt: null },
        });

        if (!user?.passwordHash) {
          await createAuditLog({
            action: "user.login_failed",
            metadata: { email: normalizedEmail },
          });
          return null;
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          await createAuditLog({
            action: "user.login_failed",
            userId: user.id,
            metadata: { email: normalizedEmail },
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

      let resolvedUser = await adminPrisma.user.findFirst({
        where: { email, deletedAt: null },
      });

      if (!resolvedUser) {
        const provisioned = await provisionClinicFromDoctor8(p, email);
        if (!provisioned) {
          console.warn(
            "SSO doctor8 bloqueado: usuário não cadastrado, sub=",
            p?.sub,
          );
          return "/entrar?error=Doctor8SemConta";
        }
        resolvedUser = await adminPrisma.user.findFirst({
          where: { email, deletedAt: null },
        });
      }

      if (!resolvedUser) {
        return "/entrar?error=Doctor8SemConta";
      }

      let membership = findMembershipByCnpj(
        await getActiveMembershipsWithOrg(resolvedUser.id),
        p.org_cnpj,
      );

      if (!membership) {
        const provisioned = await provisionClinicFromDoctor8(p, email);
        if (!provisioned) {
          const memberships = await getActiveMembershipsWithOrg(resolvedUser.id);
          console.warn(
            "SSO doctor8 bloqueado:",
            memberships.length === 0 ? "sem membership" : "CNPJ divergente",
            "sub=",
            p?.sub,
          );
          return memberships.length === 0
            ? "/entrar?error=Doctor8SemOrganizacao"
            : "/entrar?error=Doctor8CnpjDivergente";
        }

        membership = findMembershipByCnpj(
          await getActiveMembershipsWithOrg(resolvedUser.id),
          p.org_cnpj,
        );
        if (!membership) {
          return "/entrar?error=Doctor8CnpjDivergente";
        }
      }

      await createAuditLog({
        action: "user.login",
        userId: resolvedUser.id,
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

        const orgCnpj = p?.org_cnpj;
        if (!orgCnpj) {
          throw new Error("doctor8 SSO: org_cnpj ausente no jwt");
        }

        const memberships = await getActiveMembershipsWithOrg(vital8User.id);
        const membership = findMembershipByCnpj(memberships, orgCnpj);
        if (!membership) {
          throw new Error("doctor8 SSO: CNPJ divergente");
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
        return applyValidatedSessionUpdate(
          token,
          session as SessionUpdatePayload,
          {
            resolveMembership: async (userId, organizationId) => {
              const membership = await resolveActiveMembership(
                userId,
                organizationId,
              );
              if (!membership) return null;
              return {
                organizationId: membership.organizationId,
                role: membership.role,
              };
            },
            validateBranch: validateBranchForOrganization,
          },
        );
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
