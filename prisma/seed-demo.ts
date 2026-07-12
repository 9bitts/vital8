/** Re-executa seed demo (2 unidades) sobre banco existente. */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedDemoExtras } from "./seed-phase10";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL required");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: "clinica-vida-plena" } });
  if (!org) throw new Error("Org demo não encontrada — rode npm run db:seed primeiro");
  await seedDemoExtras(prisma, org.id);
  console.log("✅ Demo seed aplicado");
}

main()
  .finally(() => prisma.$disconnect());
