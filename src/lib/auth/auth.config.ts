import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/client";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/entrar",
  },
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isProtected = path.startsWith("/app") || path.startsWith("/m");
      if (!isProtected) return true;
      return !!auth?.user && !!auth.organizationId;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        if (user.organizationId) token.organizationId = user.organizationId;
        if (user.role) token.role = user.role;
        token.branchId = user.branchId ?? null;
      }

      // Session updates with membership validation run in auth.ts (Node handler).

      return token;
    },
    async session({ session, token }) {
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
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    organizationId?: string;
    role?: Role;
    branchId?: string | null;
  }
}
