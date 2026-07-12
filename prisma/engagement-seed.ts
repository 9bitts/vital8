import type { PrismaClient } from "../src/generated/prisma/client";

const TEMPLATE_BODIES: Record<string, string> = {
  APPOINTMENT_CONFIRMATION:
    "Olá {{paciente}}! Lembrete: consulta de {{servico}} com {{profissional}} em {{data}} às {{hora}}. Confirme: {{link}} — {{clinica}}",
  RETURN_REMINDER:
    "Olá {{paciente}}, está na hora de agendar retorno de {{servico}}. {{clinica}}",
  BIRTHDAY: "Feliz aniversário, {{paciente}}! 🎂 Equipe {{clinica}}",
  POST_ENCOUNTER_NPS:
    "Olá {{paciente}}, como foi seu atendimento com {{profissional}}? Avalie: {{link}} — {{clinica}}",
  OVERDUE_COLLECTION:
    "Olá {{paciente}}, identificamos pendência financeira. Regularize: {{link}} — {{clinica}}",
  CAMPANHA: "Olá {{paciente}}! Novidades na {{clinica}}. {{descadastro}}",
};

export async function seedEngagement(
  prisma: PrismaClient,
  organizationId: string,
  opts: {
    serviceIds: string[];
    professionalIds: string[];
    patientIds: string[];
    appointmentId?: string;
    encounterId?: string;
  },
) {
  const templates = [];
  for (const [eventKey, body] of Object.entries(TEMPLATE_BODIES)) {
    const tpl = await prisma.messageTemplate.upsert({
      where: {
        organizationId_eventKey_channel: {
          organizationId,
          eventKey,
          channel: "WHATSAPP",
        },
      },
      create: {
        organizationId,
        eventKey,
        name: `Padrão ${eventKey}`,
        channel: "WHATSAPP",
        body,
        isDefault: true,
      },
      update: { body },
    });
    templates.push(tpl);
  }

  const confirmTpl = templates.find((t) => t.eventKey === "APPOINTMENT_CONFIRMATION")!;
  const npsTpl = templates.find((t) => t.eventKey === "POST_ENCOUNTER_NPS")!;

  await prisma.automationRule.upsert({
    where: { id: `${organizationId}-confirm-48` },
    create: {
      id: `${organizationId}-confirm-48`,
      organizationId,
      name: "Confirmação H-48",
      triggerEvent: "APPOINTMENT_CONFIRMATION",
      offsetValue: -48,
      offsetUnit: "HOURS",
      channel: "WHATSAPP",
      templateId: confirmTpl.id,
      isActive: true,
    },
    update: {},
  });

  await prisma.automationRule.upsert({
    where: { id: `${organizationId}-confirm-24` },
    create: {
      id: `${organizationId}-confirm-24`,
      organizationId,
      name: "Confirmação H-24",
      triggerEvent: "APPOINTMENT_CONFIRMATION",
      offsetValue: -24,
      offsetUnit: "HOURS",
      channel: "WHATSAPP",
      templateId: confirmTpl.id,
      isActive: true,
    },
    update: {},
  });

  await prisma.automationRule.upsert({
    where: { id: `${organizationId}-nps` },
    create: {
      id: `${organizationId}-nps`,
      organizationId,
      name: "NPS pós-atendimento H+2",
      triggerEvent: "POST_ENCOUNTER_NPS",
      offsetValue: 2,
      offsetUnit: "HOURS",
      channel: "WHATSAPP",
      templateId: npsTpl.id,
      isActive: true,
    },
    update: {},
  });

  await prisma.onlineBookingConfig.upsert({
    where: { organizationId },
    create: {
      organizationId,
      isEnabled: true,
      enabledServiceIds: opts.serviceIds.slice(0, 3),
      enabledProfessionalIds: opts.professionalIds.slice(0, 2),
      minAdvanceHours: 4,
      maxAdvanceDays: 60,
      requiresApproval: true,
      welcomeText: "Agende sua consulta online de forma rápida e segura.",
      autoReleaseDocuments: true,
    },
    update: { isEnabled: true },
  });

  const teleService = await prisma.service.findFirst({
    where: { organizationId, isTeleconsult: true },
  });

  if (teleService && opts.appointmentId && opts.patientIds[0]) {
    const consent = await prisma.teleconsultConsent.upsert({
      where: { appointmentId: opts.appointmentId },
      create: {
        organizationId,
        patientId: opts.patientIds[0]!,
        appointmentId: opts.appointmentId,
        termVersion: "CFM-2314-2022-v1",
        token: "seed-teleconsult-consent-token",
        acceptedAt: new Date(),
        ipAddress: "127.0.0.1",
        expiresAt: new Date(Date.now() + 30 * 86400_000),
      },
      update: { acceptedAt: new Date() },
    });

    if (opts.encounterId) {
      await prisma.encounter.update({
        where: { id: opts.encounterId },
        data: {
          modality: "TELECONSULTA",
          teleconsultConsentId: consent.id,
        },
      });
      await prisma.teleconsultRoom.upsert({
        where: { encounterId: opts.encounterId },
        create: {
          organizationId,
          encounterId: opts.encounterId,
          roomUrl: "https://meet.jit.si/vital8-seed-tele",
          roomName: "vital8-seed-tele",
          expiresAt: new Date(Date.now() + 86400_000),
          professionalJoinedAt: new Date(),
          patientJoinedAt: new Date(),
        },
        update: {},
      });
    }
  }

  const patientId = opts.patientIds[0];
  if (patientId) {
    const survey = await prisma.npsSurvey.create({
      data: {
        organizationId,
        patientId,
        token: "seed-nps-token-1",
        expiresAt: new Date(Date.now() + 30 * 86400_000),
        encounterId: opts.encounterId ?? null,
      },
    });
    await prisma.npsResponse.create({
      data: {
        organizationId,
        surveyId: survey.id,
        score: 9,
        comment: "Ótimo atendimento!",
      },
    });
    const survey2 = await prisma.npsSurvey.create({
      data: {
        organizationId,
        patientId: opts.patientIds[1] ?? patientId,
        token: "seed-nps-token-2",
        expiresAt: new Date(Date.now() + 30 * 86400_000),
      },
    });
    await prisma.npsResponse.create({
      data: {
        organizationId,
        surveyId: survey2.id,
        score: 5,
        comment: "Demorou na recepção.",
      },
    });
  }

  console.log("  ✓ Engagement (templates, réguas, portal, NPS, teleconsulta)");
}
