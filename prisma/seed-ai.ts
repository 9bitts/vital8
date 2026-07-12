import type { PrismaClient } from "../src/generated/prisma/client";
import { AI_TERM_VERSION } from "../src/modules/ai/lib/consent";

const ALL_RESOURCES = [
  "VIRTUAL_SECRETARY",
  "CLINICAL_COPILOT",
  "SMART_COLLECTION",
  "NO_SHOW_SCORING",
  "BI_INSIGHTS",
  "GLOSA_DRAFT",
  "SMART_SEARCH",
] as const;

export async function seedAi(
  prisma: PrismaClient,
  organizationId: string,
  ownerUserId: string,
) {
  await prisma.aiSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      enabledResources: Object.fromEntries(ALL_RESOURCES.map((r) => [r, true])),
      monthlyTokenLimit: 500_000,
      silenceStartHour: 22,
      silenceEndHour: 7,
    },
    update: {
      enabledResources: Object.fromEntries(ALL_RESOURCES.map((r) => [r, true])),
    },
  });

  for (const resource of ALL_RESOURCES) {
    await prisma.aiDataProcessingConsent.upsert({
      where: { organizationId_resource: { organizationId, resource } },
      create: {
        organizationId,
        resource,
        termVersion: AI_TERM_VERSION,
        grantedByUserId: ownerUserId,
      },
      update: { revokedAt: null, termVersion: AI_TERM_VERSION },
    });
  }

  await prisma.aiFaq.createMany({
    data: [
      {
        organizationId,
        question: "Qual o horário de funcionamento?",
        answer: "Atendemos de segunda a sexta, das 8h às 18h.",
        sortOrder: 1,
      },
      {
        organizationId,
        question: "Como chegar na clínica?",
        answer: "Consulte o endereço no site ou ligue para a recepção.",
        sortOrder: 2,
      },
    ],
    skipDuplicates: true,
  });

  return { consents: ALL_RESOURCES.length };
}
