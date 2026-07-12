import type { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_LANDING_BLOCKS } from "../src/modules/marketing/services/landing-page.service";

export async function seedMarketing(prisma: PrismaClient, organizationId: string) {
  const sources = await Promise.all([
    prisma.leadSource.upsert({
      where: { organizationId_slug: { organizationId, slug: "instagram" } },
      create: { organizationId, name: "Instagram", slug: "instagram" },
      update: {},
    }),
    prisma.leadSource.upsert({
      where: { organizationId_slug: { organizationId, slug: "google" } },
      create: { organizationId, name: "Google Ads", slug: "google" },
      update: {},
    }),
    prisma.leadSource.upsert({
      where: { organizationId_slug: { organizationId, slug: "indicacao" } },
      create: { organizationId, name: "Indicação", slug: "indicacao" },
      update: {},
    }),
  ]);

  const campaign = await prisma.marketingCampaign.create({
    data: {
      organizationId,
      name: "Campanha Verão 2026",
      leadSourceId: sources[1]!.id,
      channel: "Google Ads",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-03-31"),
      investmentCents: 500_000,
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "verao2026",
    },
  });

  await prisma.landingPage.upsert({
    where: { organizationId_slug: { organizationId, slug: "consulta-inicial" } },
    create: {
      organizationId,
      slug: "consulta-inicial",
      title: "Consulta inicial — Clínica Vida Plena",
      metaDescription: "Agende sua consulta. Equipe qualificada, sem promessas de resultado.",
      blocks: DEFAULT_LANDING_BLOCKS as object,
      published: true,
      publishedAt: new Date(),
    },
    update: { published: true, publishedAt: new Date() },
  });

  await prisma.referralProgram.upsert({
    where: { organizationId },
    create: {
      organizationId,
      rewardType: "DESCONTO",
      rewardValue: "15% na próxima consulta",
      maxPerPatientMonth: 3,
      isActive: true,
    },
    update: {},
  });

  const statuses = [
    "NOVO",
    "NOVO",
    "EM_CONTATO",
    "EM_CONTATO",
    "AGENDOU",
    "AGENDOU",
    "COMPARECEU",
    "CONVERTIDO",
    "CONVERTIDO",
    "CONVERTIDO",
    "CONVERTIDO",
    "PERDIDO",
    "NOVO",
    "EM_CONTATO",
    "AGENDOU",
  ] as const;

  const patients = await prisma.patient.findMany({
    where: { organizationId },
    take: 4,
    select: { id: true },
  });

  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i]!;
    const isConverted = status === "CONVERTIDO";
    const patient = isConverted && patients[i % patients.length] ? patients[i % patients.length] : null;
    await prisma.lead.create({
      data: {
        organizationId,
        fullName: `Lead Seed ${i + 1}`,
        phoneSearch: `119999900${String(i).padStart(2, "0")}`,
        email: `lead${i + 1}@example.local`,
        status,
        leadSourceId: sources[i % 3]!.id,
        marketingCampaignId: campaign.id,
        utmSource: i % 2 === 0 ? "google" : "instagram",
        utmMedium: "cpc",
        utmCampaign: "verao2026",
        marketingConsentAt: new Date(),
        marketingConsentIp: "127.0.0.1",
        patientId: patient?.id ?? null,
        lastStatusAt: new Date(),
      },
    });
    if (patient && isConverted) {
      await prisma.patient.update({
        where: { id: patient.id },
        data: {
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "verao2026",
          leadSourceId: sources[1]!.id,
          marketingCampaignId: campaign.id,
          acquiredAt: new Date(),
        },
      });
      await prisma.sale.create({
        data: {
          organizationId,
          patientId: patient.id,
          status: "CONFIRMADA",
          subtotalCents: 25_000,
          totalCents: 25_000,
          createdByUserId: (await prisma.user.findFirst({ select: { id: true } }))!.id,
        },
      });
    }
  }

  if (patients[0] && patients[1]) {
    const program = await prisma.referralProgram.findUniqueOrThrow({
      where: { organizationId },
    });
    await prisma.referral.createMany({
      data: [
        {
          organizationId,
          programId: program.id,
          referrerPatientId: patients[0].id,
          status: "PREMIADA",
          rewardedAt: new Date(),
        },
        {
          organizationId,
          programId: program.id,
          referrerPatientId: patients[1].id,
          status: "PENDENTE",
        },
      ],
    });
  }

  await prisma.trackedLink.create({
    data: {
      organizationId,
      code: "verao26",
      targetUrl: `/lp/clinica-vida-plena/consulta-inicial?utm_source=google&utm_medium=cpc&utm_campaign=verao2026`,
      marketingCampaignId: campaign.id,
    },
  });

  await prisma.testimonial.create({
    data: {
      organizationId,
      authorName: "Maria S.",
      content: "Atendimento acolhedor e profissional.",
      status: "PUBLICADO",
      consentAt: new Date(),
      consentIp: "127.0.0.1",
    },
  });

  console.log("  ✓ Marketing (canais, campanha, leads, landing, indicação)");
}
