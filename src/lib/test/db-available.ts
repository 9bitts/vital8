import { adminPrisma } from "@/lib/db/admin-client";

export async function isDatabaseAvailable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    await adminPrisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
