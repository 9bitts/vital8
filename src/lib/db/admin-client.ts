/**
 * Cliente Prisma administrativo — uso restrito.
 *
 * Utilize APENAS para rotinas de sistema que não operam no contexto de um tenant:
 * - signup (criação de User + Organization + Membership)
 * - aceite de convite (criação de Membership)
 * - autenticação (busca de User por email)
 * - troca de organização (listagem de memberships do usuário)
 * - jobs administrativos internos
 *
 * NUNCA use para leitura/escrita de dados de negócio tenant-scoped em rotas autenticadas.
 * Para isso, use createTenantClient(organizationId).
 */
import { createPrismaClient } from "@/lib/db/create-prisma";

const globalForPrisma = globalThis as unknown as {
  adminPrisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const adminPrisma =
  globalForPrisma.adminPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.adminPrisma = adminPrisma;
}
