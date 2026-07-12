import type { PrismaClient } from "../src/generated/prisma/client";
import { encryptPHI } from "../src/lib/crypto/phi";
import { createHash } from "crypto";

function hashContent(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

const SPECIALTIES = [
  {
    specialty: "medicina_geral",
    sections: [
      "ANAMNESE",
      "EVOLUCAO_SOAP",
      "HIPOTESE_DIAGNOSTICA",
      "CONDUTA",
    ] as const,
  },
  {
    specialty: "odontologia",
    sections: ["ANAMNESE", "ODONTOGRAMA", "CONDUTA"] as const,
  },
  {
    specialty: "fisioterapia",
    sections: ["EVOLUCAO_FISIO", "PLANO_TRATAMENTO", "CONDUTA"] as const,
  },
  {
    specialty: "psicologia",
    sections: ["REGISTRO_RESERVADO"] as const,
  },
  {
    specialty: "nutricao",
    sections: ["ANAMNESE", "ANTROPOMETRIA", "CONDUTA"] as const,
  },
];

async function createSignedEncounter(
  prisma: PrismaClient,
  orgId: string,
  authorUserId: string,
  patientId: string,
  professionalId: string,
  spec: (typeof SPECIALTIES)[number],
  dayOffset: number,
  extras?: {
    odontogram?: boolean;
    bodyChart?: boolean;
    examResult?: boolean;
  },
) {
  const startedAt = new Date();
  startedAt.setDate(startedAt.getDate() - dayOffset);

  const encounter = await prisma.encounter.create({
    data: {
      organizationId: orgId,
      patientId,
      professionalId,
      authorUserId,
      specialty: spec.specialty,
      startedAt,
      endedAt: startedAt,
      status: "ASSINADO",
      signedAt: startedAt,
    },
  });

  const sectionData = [];
  for (let s = 0; s < spec.sections.length; s++) {
    const type = spec.sections[s];
    const content = encryptPHI(
      `Conteúdo seed ${type} — offset ${dayOffset}`,
    );
    const section = await prisma.encounterSection.create({
      data: {
        organizationId: orgId,
        encounterId: encounter.id,
        sectionType: type,
        contentEncrypted: content,
        restrictedToAuthor: type === "REGISTRO_RESERVADO",
        sortOrder: s,
        structuredData:
          type === "EVOLUCAO_SOAP"
            ? {
                subjective: "Queixa seed",
                objective: "Estável",
                assessment: "J06.9",
                plan: "Sintomáticos",
              }
            : type === "ANTROPOMETRIA"
              ? {
                  medidas: [
                    {
                      data: startedAt.toISOString(),
                      peso: 70 + dayOffset,
                      altura: 170,
                    },
                  ],
                }
              : type === "HIPOTESE_DIAGNOSTICA"
                ? { cidCodes: ["J06.9"] }
                : {},
      },
    });
    sectionData.push({
      id: section.id,
      sectionType: type,
      contentPlain: `Conteúdo seed ${type}`,
      structuredData: section.structuredData,
      restrictedToAuthor: section.restrictedToAuthor,
      sortOrder: s,
    });
  }

  await prisma.encounter.update({
    where: { id: encounter.id },
    data: {
      contentHash: hashContent({ id: encounter.id, sections: sectionData }),
    },
  });

  if (extras?.odontogram) {
    const od = await prisma.odontogram.create({
      data: { organizationId: orgId, encounterId: encounter.id },
    });
    await prisma.odontogramEntry.create({
      data: {
        organizationId: orgId,
        odontogramId: od.id,
        toothFdi: 16,
        finding: "Cárie oclusal",
        status: "PLANEJADO",
      },
    });
  }

  if (extras?.bodyChart) {
    await prisma.bodyChartEntry.create({
      data: {
        organizationId: orgId,
        encounterId: encounter.id,
        x: 45,
        y: 55,
        label: "Dor lombar",
        noteEncrypted: encryptPHI("Dor irradiada para MMII"),
      },
    });
  }

  if (extras?.examResult) {
    await prisma.examResult.create({
      data: {
        organizationId: orgId,
        patientId,
        encounterId: encounter.id,
        fileName: "hemograma-seed.pdf",
        mimeType: "application/pdf",
        values: {
          create: [
            {
              organizationId: orgId,
              name: "Hemoglobina",
              value: "14.2",
              unit: "g/dL",
              referenceRange: "12-16",
            },
          ],
        },
      },
    });
  }

  return encounter;
}

export async function seedEmr(
  prisma: PrismaClient,
  orgId: string,
  authorUserId: string,
) {
  const patients = await prisma.patient.findMany({
    where: { organizationId: orgId },
    take: 8,
  });
  const professionals = await prisma.professional.findMany({
    where: { organizationId: orgId },
    take: 2,
  });
  if (patients.length === 0 || professionals.length === 0) return;

  const prof = professionals[0];

  await prisma.documentTemplate.createMany({
    data: [
      {
        organizationId: orgId,
        name: "Atestado padrão",
        type: "ATESTADO",
        bodyTemplate:
          "Atesto para os devidos fins que {{paciente}} esteve sob meus cuidados em {{data}} e necessita de {{dias}} dia(s) de repouso.",
      },
      {
        organizationId: orgId,
        name: "Declaração de comparecimento",
        type: "COMPARECIMENTO",
        bodyTemplate:
          "Declaro que {{paciente}} compareceu a consulta em {{data}} com {{profissional}}.",
      },
    ],
    skipDuplicates: true,
  });

  await prisma.formTemplate.create({
    data: {
      organizationId: orgId,
      name: "Anamnese nutricional",
      specialty: "nutricao",
      versions: {
        create: {
          organizationId: orgId,
          version: 1,
          schema: {
            fields: [
              { id: "refeicoes", type: "TEXT", label: "Refeições/dia" },
              { id: "agua", type: "NUMBER", label: "Água (L/dia)" },
            ],
          },
        },
      },
    },
  });

  let created = 0;
  const targets = [
    { spec: SPECIALTIES[0], patient: 0, offset: 30, extras: { examResult: true } },
    { spec: SPECIALTIES[1], patient: 1, offset: 25, extras: { odontogram: true } },
    { spec: SPECIALTIES[2], patient: 2, offset: 20, extras: { bodyChart: true } },
    { spec: SPECIALTIES[3], patient: 3, offset: 15, extras: {} },
    { spec: SPECIALTIES[4], patient: 4, offset: 10, extras: {} },
    { spec: SPECIALTIES[0], patient: 5, offset: 8, extras: {} },
    { spec: SPECIALTIES[1], patient: 0, offset: 6, extras: { odontogram: true } },
    { spec: SPECIALTIES[2], patient: 1, offset: 4, extras: { bodyChart: true } },
    { spec: SPECIALTIES[4], patient: 2, offset: 2, extras: {} },
    { spec: SPECIALTIES[0], patient: 3, offset: 1, extras: { examResult: true } },
  ];

  for (const t of targets) {
    const patient = patients[t.patient % patients.length];
    await createSignedEncounter(
      prisma,
      orgId,
      authorUserId,
      patient.id,
      prof.id,
      t.spec,
      t.offset,
      t.extras,
    );
    created++;
  }

  const firstEncounter = await prisma.encounter.findFirst({
    where: { organizationId: orgId, specialty: "medicina_geral" },
    orderBy: { startedAt: "asc" },
  });

  if (firstEncounter) {
    await prisma.prescription.create({
      data: {
        organizationId: orgId,
        encounterId: firstEncounter.id,
        patientId: firstEncounter.patientId,
        professionalId: prof.id,
        authorUserId,
        type: "COMUM",
        signedAt: firstEncounter.signedAt ?? new Date(),
        items: {
          create: [
            {
              organizationId: orgId,
              drugName: "Paracetamol 500mg",
              dosage: "1 comprimido 6/6h por 5 dias",
              route: "oral",
              quantity: "20 comprimidos",
            },
          ],
        },
      },
    });

    await prisma.medicalCertificate.create({
      data: {
        organizationId: orgId,
        encounterId: firstEncounter.id,
        patientId: firstEncounter.patientId,
        authorUserId,
        type: "ATESTADO",
        contentEncrypted: encryptPHI(
          "Atesto repouso de 2 dias conforme avaliação clínica.",
        ),
        signedAt: firstEncounter.signedAt ?? new Date(),
      },
    });
  }

  console.log(`  EMR: ${created} encontros assinados seed`);
}
