import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/auth/password";
import { seedPatients } from "./patients-seed";
import { seedScheduling } from "./scheduling-seed";
import { seedCid10 } from "./cid10-seed";
import { seedDrugCatalog } from "./drug-catalog-seed";
import { seedEmr } from "./emr-seed";
import { seedFinance } from "./finance-seed";
import { seedTiss } from "./tiss-seed";
import { seedInventory } from "./inventory-seed";
import { seedEngagement } from "./engagement-seed";
import { seedAnalytics } from "./seed-analytics";
import { seedPhase10, seedDemoExtras } from "./seed-phase10";
import { seedApi } from "./seed-api";
import { seedAi } from "./seed-ai";
import { seedInteroperability } from "./seed-interoperability";
import { seedMarketing } from "./seed-marketing";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não configurada para seed");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DEV_PASSWORD = "Vital8@dev";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
    throw new Error(
      "Seed bloqueado em produção. Defina ALLOW_SEED=true apenas em ambiente controlado.",
    );
  }

  console.log("🌱 Iniciando seed do Vital8...");

  await prisma.auditLog.deleteMany();
  await prisma.recordAccessLog.deleteMany();
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhookEndpoint.deleteMany();
  await prisma.apiIdempotencyRecord.deleteMany();
  await prisma.apiRequestLog.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.apiClient.deleteMany();
  await prisma.aiConversationMessage.deleteMany();
  await prisma.aiConversation.deleteMany();
  await prisma.aiInteractionLog.deleteMany();
  await prisma.aiUsageMonthly.deleteMany();
  await prisma.aiDataProcessingConsent.deleteMany();
  await prisma.aiFaq.deleteMany();
  await prisma.aiSettings.deleteMany();
  await prisma.labResultReconciliation.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.referralProgram.deleteMany();
  await prisma.leadFollowUpLog.deleteMany();
  await prisma.leadInteraction.deleteMany();
  await prisma.leadOptOut.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.trackedLink.deleteMany();
  await prisma.landingPage.deleteMany();
  await prisma.testimonial.deleteMany();
  await prisma.marketingCampaign.deleteMany();
  await prisma.leadSource.deleteMany();
  await prisma.rndsSubmission.deleteMany();
  await prisma.rndsCredential.deleteMany();
  await prisma.interoperabilitySettings.deleteMany();
  await prisma.userReportPreference.deleteMany();
  await prisma.userNotificationPreference.deleteMany();
  await prisma.userNotification.deleteMany();
  await prisma.scheduledReport.deleteMany();
  await prisma.performanceGoal.deleteMany();
  await prisma.dailyProfessionalMetrics.deleteMany();
  await prisma.dailyOrgMetrics.deleteMany();
  await prisma.npsResponse.deleteMany();
  await prisma.npsSurvey.deleteMany();
  await prisma.teleconsultRoom.deleteMany();
  await prisma.teleconsultConsent.deleteMany();
  await prisma.releasedDocument.deleteMany();
  await prisma.communicationLog.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.patientOptOut.deleteMany();
  await prisma.patientPortalSession.deleteMany();
  await prisma.patientPortalOtp.deleteMany();
  await prisma.patientDataCorrectionRequest.deleteMany();
  await prisma.onlineBookingConfig.deleteMany();
  await prisma.inventoryCount.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockBalance.deleteMany();
  await prisma.stockBatch.deleteMany();
  await prisma.serviceConsumptionKitItem.deleteMany();
  await prisma.serviceConsumptionKit.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.product.deleteMany();
  await prisma.stockLocation.deleteMany();
  await prisma.glosaItem.deleteMany();
  await prisma.insurerPayment.deleteMany();
  await prisma.tissGuide.deleteMany();
  await prisma.tissBatch.deleteMany();
  await prisma.tissSequence.deleteMany();
  await prisma.priorAuthorization.deleteMany();
  await prisma.insurerContract.deleteMany();
  await prisma.healthInsurer.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.commissionStatementItem.deleteMany();
  await prisma.commissionStatement.deleteMany();
  await prisma.commissionRule.deleteMany();
  await prisma.cashRegisterEntry.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.cashRegister.deleteMany();
  await prisma.receivable.deleteMany();
  await prisma.packageSessionConsumption.deleteMany();
  await prisma.packagePurchase.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.package.deleteMany();
  await prisma.priceTableItem.deleteMany();
  await prisma.priceTable.deleteMany();
  await prisma.payable.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.financialCategory.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.examResultValue.deleteMany();
  await prisma.examResult.deleteMany();
  await prisma.examRequestItem.deleteMany();
  await prisma.examRequest.deleteMany();
  await prisma.prescriptionItem.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.medicalCertificate.deleteMany();
  await prisma.formResponse.deleteMany();
  await prisma.formTemplateVersion.deleteMany();
  await prisma.formTemplate.deleteMany();
  await prisma.documentTemplate.deleteMany();
  await prisma.odontogramEntry.deleteMany();
  await prisma.odontogram.deleteMany();
  await prisma.bodyChartEntry.deleteMany();
  await prisma.encounterAmendment.deleteMany();
  await prisma.encounterSection.deleteMany();
  await prisma.encounter.deleteMany();
  await prisma.drugCatalog.deleteMany();
  await prisma.cid10Code.deleteMany();
  await prisma.glosaReasonCode.deleteMany();
  await prisma.tussProcedure.deleteMany();
  await prisma.appointmentConfirmation.deleteMany();
  await prisma.appointmentStatusHistory.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.waitingListEntry.deleteMany();
  await prisma.scheduleException.deleteMany();
  await prisma.scheduleTemplate.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.room.deleteMany();
  await prisma.service.deleteMany();
  await prisma.professional.deleteMany();
  await prisma.patientMedication.deleteMany();
  await prisma.chronicCondition.deleteMany();
  await prisma.allergy.deleteMany();
  await prisma.patientDocument.deleteMany();
  await prisma.patientConsent.deleteMany();
  await prisma.patientInsurancePlan.deleteMany();
  await prisma.patientGuardian.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.membershipBranch.deleteMany();
  await prisma.organizationExport.deleteMany();
  await prisma.onboardingProgress.deleteMany();
  await prisma.subscriptionInvoice.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.permissionProfile.deleteMany();
  await prisma.branch.deleteMany();
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
      plan: "ENTERPRISE",
      settings: { cnes: "1234567" },
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

  const estoqueUser = await prisma.user.create({
    data: {
      name: "Edu Estoque",
      email: "edu@vidaplena.local",
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
      {
        userId: estoqueUser.id,
        organizationId: orgVidaPlena.id,
        role: "ESTOQUE",
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
  await seedScheduling(prisma, orgVidaPlena.id, orgDrTeste.id);
  await seedCid10(prisma);
  await seedDrugCatalog(prisma);
  await seedEmr(prisma, orgVidaPlena.id, ownerVidaPlena.id);
  await seedEmr(prisma, orgDrTeste.id, ownerDrTeste.id);
  await seedFinance(prisma, orgVidaPlena.id, ownerVidaPlena.id);
  await seedFinance(prisma, orgDrTeste.id, ownerDrTeste.id);
  await seedTiss(prisma, orgVidaPlena.id, ownerVidaPlena.id);
  await seedInventory(prisma, orgVidaPlena.id, ownerVidaPlena.id);

  await prisma.service.updateMany({
    where: { organizationId: orgVidaPlena.id, name: { contains: "Retorno" } },
    data: { isTeleconsult: true, allowOnlineBooking: true },
  });
  const onlineServices = await prisma.service.findMany({
    where: { organizationId: orgVidaPlena.id, allowOnlineBooking: false },
    select: { id: true },
    take: 3,
  });
  if (onlineServices.length) {
    await prisma.service.updateMany({
      where: { id: { in: onlineServices.map((s) => s.id) } },
      data: { allowOnlineBooking: true },
    });
  }

  const services = await prisma.service.findMany({
    where: { organizationId: orgVidaPlena.id },
    select: { id: true },
    take: 5,
  });
  const professionals = await prisma.professional.findMany({
    where: { organizationId: orgVidaPlena.id },
    select: { id: true },
  });
  const patients = await prisma.patient.findMany({
    where: { organizationId: orgVidaPlena.id },
    select: { id: true },
    take: 5,
  });
  const teleAppt = await prisma.appointment.findFirst({
    where: {
      organizationId: orgVidaPlena.id,
      service: { isTeleconsult: true },
    },
  });
  const encounter = teleAppt
    ? await prisma.encounter.findFirst({ where: { appointmentId: teleAppt.id } })
    : null;

  await seedEngagement(prisma, orgVidaPlena.id, {
    serviceIds: services.map((s) => s.id),
    professionalIds: professionals.map((p) => p.id),
    patientIds: patients.map((p) => p.id),
    appointmentId: teleAppt?.id,
    encounterId: encounter?.id,
  });

  await seedAnalytics(prisma, orgVidaPlena.id);
  await seedMarketing(prisma, orgVidaPlena.id);

  const memVp = await prisma.membership.findFirstOrThrow({
    where: { userId: ownerVidaPlena.id, organizationId: orgVidaPlena.id },
  });
  const memDt = await prisma.membership.findFirstOrThrow({
    where: { userId: ownerDrTeste.id, organizationId: orgDrTeste.id },
  });
  await seedPhase10(prisma, orgVidaPlena.id, orgDrTeste.id, {
    vidaPlenaOwner: memVp.id,
    drTesteOwner: memDt.id,
  });
  await seedDemoExtras(prisma, orgVidaPlena.id);

  const apiSeed = await seedApi(prisma, orgVidaPlena.id, orgVidaPlena.slug);
  await seedAi(prisma, orgVidaPlena.id, ownerVidaPlena.id);
  await seedInteroperability(prisma, orgVidaPlena.id, ownerVidaPlena.id);

  console.log("✅ Seed concluído (Fase 15 — Marketing incluída)");
  console.log("");
  console.log("Contas de desenvolvimento (senha para todas):", DEV_PASSWORD);
  console.log("- ana@vidaplena.local (OWNER — Clínica Vida Plena)");
  console.log("- carlos@drteste.local (OWNER — Consultório Dr. Teste)");
  console.log("- bruno@multi.local (ADMIN + FINANCEIRO — testar switcher)");
  console.log("- carla@vidaplena.local (RECEPCAO — Clínica Vida Plena)");
  if (apiSeed) {
    console.log("");
    console.log("API Doctor8 (SANDBOX):");
    console.log("- Bearer token (exibido no seed):", apiSeed.token);
    console.log("- Teste: curl -H \"Authorization: Bearer <token>\" http://localhost:3000/api/v1/ping");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
