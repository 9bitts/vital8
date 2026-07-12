import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/client";

export const authConfig = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: {
    signIn: "/entrar",
  },
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isProtected = path.startsWith("/app") || path.startsWith("/m");
      if (!isProtected) return true;
      if (auth?.error === "SessionRevoked") return false;
      return !!auth?.user && !!auth.organizationId;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        if (user.organizationId) token.organizationId = user.organizationId;
        if (user.role) token.role = user.role;
        token.branchId = user.branchId ?? null;
        if (user.userSessionVersion !== undefined) {
          token.userSessionVersion = user.userSessionVersion;
        }
        if (user.membershipSessionVersion !== undefined) {
          token.membershipSessionVersion = user.membershipSessionVersion;
        }
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
    async session({ session, token }) {
      if (token.error === "SessionRevoked") {
        return { ...session, error: "SessionRevoked" as const };
      }
      return {
        ...session,
        user: {
          id: token.id as string,
          email: token.sub ?? "",
          name: (token.name as string) ?? session.user?.name ?? "",
        },
        organizationId: token.organizationId as string,
        role: token.role as Role,
        branchId: (token.branchId as string | null) ?? null,
      };
    },
  },
  providers: [],
} satisfies NextAuthConfig;

declare module "next-auth" {
  interface Session {
    organizationId: string;
    role: Role;
    branchId: string | null;
    error?: "SessionRevoked";
    user: {
      id: string;
      email: string;
      name: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    organizationId?: string;
    role?: Role;
    branchId?: string | null;
    userSessionVersion?: number;
    membershipSessionVersion?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    organizationId?: string;
    role?: Role;
    branchId?: string | null;
    userSessionVersion?: number;
    membershipSessionVersion?: number;
    error?: "SessionRevoked";
  }
}
