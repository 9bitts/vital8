import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/client";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/entrar",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isApp = request.nextUrl.pathname.startsWith("/app");
      if (!isApp) return true;
      return !!auth?.user && !!auth.organizationId;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.organizationId = user.organizationId;
        token.role = user.role;
      }

      if (trigger === "update" && session) {
        const updateSession = session as {
          organizationId?: string;
          role?: Role;
        };

        if (updateSession.organizationId && updateSession.role) {
          token.organizationId = updateSession.organizationId;
          token.role = updateSession.role;
        }
      }

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
      };
    },
  },
  providers: [],
} satisfies NextAuthConfig;

declare module "next-auth" {
  interface Session {
    organizationId: string;
    role: Role;
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
    organizationId: string;
    role: Role;
  }
}
