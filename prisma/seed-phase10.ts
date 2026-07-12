import type { PrismaClient } from "../src/generated/prisma/client";
import { seedDefaultProfiles, assignDefaultProfile } from "../src/modules/admin/services/permission-profile.service";
import { ensureSubscription } from "../src/modules/admin/services/subscription.service";
import { ensureMainBranch } from "../src/modules/admin/services/branch.service";

export async function seedPhase10(
  prisma: PrismaClient,
  orgVidaPlenaId: string,
  orgDrTesteId: string,
  membershipIds: { vidaPlenaOwner: string; drTesteOwner: string },
) {
  await ensureMainBranch(orgVidaPlenaId);
  await ensureMainBranch(orgDrTesteId);

  const branch2 = await prisma.branch.upsert({
    where: { id: `${orgVidaPlenaId}-filial-norte` },
    create: {
      id: `${orgVidaPlenaId}-filial-norte`,
      organizationId: orgVidaPlenaId,
      name: "Unidade Norte",
      address: { city: "São Paulo", district: "Santana" },
      cnes: "7654321",
      isMain: false,
    },
    update: {},
  });

  await seedDefaultProfiles(orgVidaPlenaId);
  await seedDefaultProfiles(orgDrTesteId);

  await assignDefaultProfile(membershipIds.vidaPlenaOwner, "OWNER", orgVidaPlenaId);
  await assignDefaultProfile(membershipIds.drTesteOwner, "OWNER", orgDrTesteId);

  await ensureSubscription(orgVidaPlenaId, "ENTERPRISE");
  await ensureSubscription(orgDrTesteId, "BASICO");

  await prisma.subscription.update({
    where: { organizationId: orgVidaPlenaId },
    data: { status: "ATIVA", plan: "ENTERPRISE" },
  });

  await prisma.onboardingProgress.upsert({
    where: { organizationId: orgVidaPlenaId },
    create: {
      organizationId: orgVidaPlenaId,
      steps: {
        clinic_data: true,
        first_branch: true,
        professionals: true,
        services: true,
        schedule: true,
      },
    },
    update: {},
  });

  const mainBranchId = `branch-main-${orgVidaPlenaId}`;
  await prisma.room.updateMany({
    where: { organizationId: orgVidaPlenaId, branchId: null },
    data: { branchId: mainBranchId },
  });

  console.log(`  ✓ Fase 10 (unidades, permissões, assinatura, filial demo: ${branch2.name})`);
}

/** Demo comercial — 2 unidades e dados ricos (chamado após seed completo). */
export async function seedDemoExtras(prisma: PrismaClient, organizationId: string) {
  const branch2 = await prisma.branch.findFirst({
    where: { organizationId, name: "Unidade Norte" },
  });
  if (!branch2) return;

  const prof = await prisma.professional.findFirst({ where: { organizationId } });
  const service = await prisma.service.findFirst({ where: { organizationId } });
  const patient = await prisma.patient.findFirst({ where: { organizationId } });
  if (!prof || !service || !patient) return;

  const room = await prisma.room.create({
    data: {
      organizationId,
      branchId: branch2.id,
      name: "Sala Norte 1",
    },
  });

  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 2);
  startsAt.setHours(10, 0, 0, 0);

  await prisma.appointment.create({
    data: {
      organizationId,
      branchId: branch2.id,
      patientId: patient.id,
      professionalId: prof.id,
      serviceId: service.id,
      roomId: room.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      status: "CONFIRMADO",
      origin: "RECEPCAO",
      isPrivate: true,
    },
  });

  console.log("  ✓ Demo comercial (agendamento Unidade Norte)");
}
