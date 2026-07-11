import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não configurada");
  }

  if (url.startsWith("prisma+postgres://")) {
    throw new Error(
      "DATABASE_URL prisma+postgres:// requer Prisma Postgres local. Use postgresql:// para o adapter pg.",
    );
  }

  return url;
}

export function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: getConnectionString() });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}
