import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/auth/password";
import { seedPatients } from "./patients-seed";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não configurada para seed");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DEV_PASSWORD = "Vital8@dev";

async function main() {
  console.log("🌱 Iniciando seed do Vital8...");

  await prisma.auditLog.deleteMany();
  await prisma.patientMedication.deleteMany();
  await prisma.chronicCondition.deleteMany();
  await prisma.allergy.deleteMany();
  await prisma.patientDocument.deleteMany();
  await prisma.patientConsent.deleteMany();
  await prisma.patientInsurancePlan.deleteMany();
  await prisma.patientGuardian.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword(DEV_PASSWORD);
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const orgVidaPlena = await prisma.organization.create({
    data: {
      name: "Clínica Vida Plena",
      slug: "clinica-vida-plena",
      documentType: "CNPJ",
      documentNumber: "11222333000181",
      type: "CLINICA",
      email: "contato@vidaplena.local",
      phone: "11999990001",
      trialEndsAt,
    },
  });

  const orgDrTeste = await prisma.organization.create({
    data: {
      name: "Consultório Dr. Teste",
      slug: "consultorio-dr-teste",
      documentType: "CPF",
      documentNumber: "12345678901",
      type: "CONSULTORIO",
      email: "contato@drteste.local",
      phone: "11999990002",
      trialEndsAt,
    },
  });

  const ownerVidaPlena = await prisma.user.create({
    data: {
      name: "Ana Proprietária",
      email: "ana@vidaplena.local",
      passwordHash,
    },
  });

  const ownerDrTeste = await prisma.user.create({
    data: {
      name: "Dr. Carlos Teste",
      email: "carlos@drteste.local",
      passwordHash,
    },
  });

  const multiOrgUser = await prisma.user.create({
    data: {
      name: "Bruno Multi-Org",
      email: "bruno@multi.local",
      passwordHash,
    },
  });

  const recepcaoUser = await prisma.user.create({
    data: {
      name: "Carla Recepção",
      email: "carla@vidaplena.local",
      passwordHash,
    },
  });

  await prisma.membership.createMany({
    data: [
      {
        userId: ownerVidaPlena.id,
        organizationId: orgVidaPlena.id,
        role: "OWNER",
      },
      {
        userId: ownerDrTeste.id,
        organizationId: orgDrTeste.id,
        role: "OWNER",
      },
      {
        userId: multiOrgUser.id,
        organizationId: orgVidaPlena.id,
        role: "ADMIN",
      },
      {
        userId: multiOrgUser.id,
        organizationId: orgDrTeste.id,
        role: "FINANCEIRO",
      },
      {
        userId: recepcaoUser.id,
        organizationId: orgVidaPlena.id,
        role: "RECEPCAO",
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      action: "seed.complete",
      organizationId: orgVidaPlena.id,
      userId: ownerVidaPlena.id,
      entityType: "System",
      metadata: { version: "phase-2" },
    },
  });

  await seedPatients(prisma, orgVidaPlena.id, orgDrTeste.id);

  console.log("✅ Seed concluído (Fase 2 — pacientes incluídos)");
  console.log("");
  console.log("Contas de desenvolvimento (senha para todas):", DEV_PASSWORD);
  console.log("- ana@vidaplena.local (OWNER — Clínica Vida Plena)");
  console.log("- carlos@drteste.local (OWNER — Consultório Dr. Teste)");
  console.log("- bruno@multi.local (ADMIN + FINANCEIRO — testar switcher)");
  console.log("- carla@vidaplena.local (RECEPCAO — Clínica Vida Plena)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
