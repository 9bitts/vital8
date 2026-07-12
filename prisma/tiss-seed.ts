import type { PrismaClient } from "../src/generated/prisma/client";
import { encryptCardNumber } from "../src/modules/patients/services/patient.service";
import { buildTissBatchXml } from "../src/lib/tiss/xml-builder";
import type { TissGuidePayload } from "../src/lib/tiss/types";

const TUSS_SEED = [
  { code: "10101012", term: "Consulta em consultório" },
  { code: "10101039", term: "Consulta em pronto socorro" },
  { code: "10101047", term: "Consulta em domicílio" },
  { code: "20101074", term: "Eletrocardiograma" },
  { code: "40301010", term: "Hemograma completo" },
  { code: "40302040", term: "Glicemia em jejum" },
  { code: "30101018", term: "Curativo simples" },
  { code: "31301010", term: "Sessão de fisioterapia" },
  { code: "41301010", term: "Ultrassonografia abdominal" },
  { code: "20102038", term: "Holter 24 horas" },
];

const GLOSA_CODES = [
  { code: "1001", description: "Procedimento não coberto pelo plano" },
  { code: "1002", description: "Autorização ausente ou inválida" },
  { code: "1003", description: "Carteirinha vencida" },
  { code: "1004", description: "Código TUSS incompatível" },
  { code: "1005", description: "Valor acima do contratado" },
  { code: "1006", description: "Duplicidade de guia" },
  { code: "1007", description: "CID não informado quando exigido" },
  { code: "1008", description: "Profissional não credenciado" },
];

export async function seedTissGlobal(prisma: PrismaClient) {
  for (const t of TUSS_SEED) {
    await prisma.tussProcedure.upsert({
      where: { code: t.code },
      create: t,
      update: { term: t.term, isActive: true },
    });
  }
  for (const g of GLOSA_CODES) {
    await prisma.glosaReasonCode.upsert({
      where: { code: g.code },
      create: g,
      update: { description: g.description },
    });
  }
}

export async function seedTiss(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
) {
  await seedTissGlobal(prisma);

  const services = await prisma.service.findMany({
    where: { organizationId: orgId },
    take: 5,
  });
  const patients = await prisma.patient.findMany({
    where: { organizationId: orgId },
    take: 5,
  });
  const professionals = await prisma.professional.findMany({
    where: { organizationId: orgId },
    take: 1,
  });
  const priceTables = await prisma.priceTable.findMany({
    where: { organizationId: orgId },
  });

  if (services.length === 0 || patients.length === 0) return;

  const tussList = await prisma.tussProcedure.findMany({ take: 5 });
  for (let i = 0; i < Math.min(services.length, tussList.length); i++) {
    await prisma.service.update({
      where: { id: services[i]!.id },
      data: {
        tussProcedureId: tussList[i]!.id,
        tussCode: tussList[i]!.code,
      },
    });
  }

  const unimedTable = priceTables.find((t) => t.insurerName === "Unimed");
  const amilTable =
    unimedTable ??
    (await prisma.priceTable.create({
      data: {
        organizationId: orgId,
        name: "Amil",
        insurerName: "Amil",
        items: {
          create: services.map((s) => ({
            organizationId: orgId,
            serviceId: s.id,
            priceCents: 12000,
          })),
        },
      },
    }));

  const unimed = await prisma.healthInsurer.create({
    data: {
      organizationId: orgId,
      name: "Unimed Demo",
      ansRegistration: "999999",
      cnpj: "00000000000191",
      tissVersion: "3.05.00",
      providerCodeAtInsurer: "PREST-001",
      paymentTermDays: 30,
      requiresAuthorization: true,
      authProcedureTypes: ["consulta"],
    },
  });

  const amil = await prisma.healthInsurer.create({
    data: {
      organizationId: orgId,
      name: "Amil Demo",
      ansRegistration: "888888",
      cnpj: "00000000000272",
      tissVersion: "4.03.00",
      providerCodeAtInsurer: "PREST-002",
      paymentTermDays: 45,
      requiresAuthorization: false,
    },
  });

  if (unimedTable) {
    await prisma.insurerContract.create({
      data: {
        organizationId: orgId,
        healthInsurerId: unimed.id,
        priceTableId: unimedTable.id,
      },
    });
  }

  await prisma.insurerContract.create({
    data: {
      organizationId: orgId,
      healthInsurerId: amil.id,
      priceTableId: amilTable.id,
    },
  });

  const cardEnc = encryptCardNumber("123456789012345");
  const plan = await prisma.patientInsurancePlan.create({
    data: {
      organizationId: orgId,
      patientId: patients[0]!.id,
      healthInsurerId: unimed.id,
      insurerName: unimed.name,
      planName: "Premium",
      cardNumberEncrypted: cardEnc.encrypted,
      cardNumberSearch: cardEnc.search,
      validUntil: new Date("2027-12-31"),
      isPrimary: true,
    },
  });

  await prisma.priorAuthorization.create({
    data: {
      organizationId: orgId,
      healthInsurerId: unimed.id,
      patientId: patients[0]!.id,
      serviceId: services[0]!.id,
      password: "AUTH-2025-001",
      validUntil: new Date("2026-12-31"),
      authorizedQty: 5,
      status: "AUTORIZADA",
    },
  });

  const org = await prisma.organization.findFirstOrThrow({ where: { id: orgId } });
  const competence = new Date().toISOString().slice(0, 7);
  const prof = professionals[0];

  const statuses = [
    "RASCUNHO",
    "PRONTA",
    "PRONTA",
    "PRONTA",
    "EM_LOTE",
    "ENVIADA",
    "PAGA",
    "GLOSADA_PARCIAL",
    "PRONTA",
    "RASCUNHO",
  ] as const;

  const guides = [];
  for (let i = 0; i < 10; i++) {
    const appt = await prisma.appointment.create({
      data: {
        organizationId: orgId,
        patientId: patients[i % patients.length]!.id,
        professionalId: prof!.id,
        serviceId: services[i % services.length]!.id,
        startsAt: new Date(Date.now() - (i + 1) * 86400000),
        endsAt: new Date(Date.now() - (i + 1) * 86400000 + 3600000),
        status: "FINALIZADO",
        isPrivate: i % 3 !== 0,
        patientInsurancePlanId: i % 3 === 0 ? plan.id : null,
        finishedAt: new Date(Date.now() - (i + 1) * 86400000),
      },
    });

    if (appt.isPrivate) continue;

    const insurer = i % 2 === 0 ? unimed : amil;
    const priceItem = await prisma.priceTableItem.findFirst({
      where: { serviceId: appt.serviceId, priceTable: { insurerName: insurer.name } },
    });
    const priceCents = priceItem?.priceCents ?? 12000;
    const tuss = tussList[i % tussList.length]!;
    const guideNumber = i + 1;
    const executedAt = appt.finishedAt!;

    const payload: TissGuidePayload = {
      registroANS: insurer.ansRegistration,
      numeroGuiaPrestador: String(guideNumber),
      dadosBeneficiario: {
        numeroCarteira: "123456789012345",
        nomeBeneficiario: patients[0]!.fullName,
        validadeCarteira: "2027-12-31",
      },
      dadosContratadoExecutante: {
        codigoCNES: "1234567",
        cnpjContratado: org.documentNumber,
      },
      profissionalExecutante: {
        nomeProfissional: prof!.displayName,
      },
      indicacaoAcidente: "0",
      caraterAtendimento: "1",
      tipoConsulta: "1",
      procedimentos: [
        {
          tussCode: tuss.code,
          term: tuss.term,
          quantity: 1,
          unitValueCents: priceCents,
          totalValueCents: priceCents,
          executionDate: executedAt.toISOString().slice(0, 10),
        },
      ],
      dataAtendimento: executedAt.toISOString().slice(0, 10),
      horaAtendimento: executedAt.toISOString().slice(11, 19),
    };

    const validationErrors =
      statuses[i] === "RASCUNHO"
        ? [{ field: "consultationType", message: "Tipo de consulta obrigatório" }]
        : [];

    const guide = await prisma.tissGuide.create({
      data: {
        organizationId: orgId,
        appointmentId: appt.id,
        healthInsurerId: insurer.id,
        guideType: "GUIA_CONSULTA",
        guideNumber,
        status: statuses[i]!,
        competence,
        validationErrors,
        beneficiaryName: patients[0]!.fullName,
        beneficiaryCard: "123456789012345",
        beneficiaryCardValidUntil: new Date("2027-12-31"),
        ansRegistration: insurer.ansRegistration,
        providerCnes: "1234567",
        providerDocument: org.documentNumber,
        professionalName: prof!.displayName,
        consultationType: statuses[i] === "RASCUNHO" ? null : "PRIMEIRA",
        procedures: payload.procedimentos,
        totalValueCents: priceCents,
        executedAt,
        payload,
      },
    });
    guides.push(guide);

    await prisma.tissSequence.upsert({
      where: {
        organizationId_healthInsurerId_sequenceType: {
          organizationId: orgId,
          healthInsurerId: insurer.id,
          sequenceType: "GUIDE",
        },
      },
      create: {
        organizationId: orgId,
        healthInsurerId: insurer.id,
        sequenceType: "GUIDE",
        lastNumber: guideNumber,
      },
      update: { lastNumber: guideNumber },
    });
  }

  const batchGuides = guides.filter((g) =>
    ["EM_LOTE", "ENVIADA", "PAGA", "GLOSADA_PARCIAL"].includes(g.status),
  );
  if (batchGuides.length === 0) return;

  const batchInsurer = unimed;
  const batchNumber = 1;
  const batch = await prisma.tissBatch.create({
    data: {
      organizationId: orgId,
      healthInsurerId: batchInsurer.id,
      batchNumber,
      competence,
      status: "ENVIADO",
      sentAt: new Date(),
      sendProtocol: "MOCK-PROTO-001",
    },
  });

  await prisma.tissSequence.create({
    data: {
      organizationId: orgId,
      healthInsurerId: batchInsurer.id,
      sequenceType: "BATCH",
      lastNumber: batchNumber,
    },
  });

  const inBatch = guides.filter((g) => g.healthInsurerId === batchInsurer.id).slice(0, 4);
  for (const g of inBatch) {
    await prisma.tissGuide.update({
      where: { id: g.id },
      data: { tissBatchId: batch.id, status: g.status === "PRONTA" ? "ENVIADA" : g.status },
    });
  }

  const batchGuideRecords = await prisma.tissGuide.findMany({
    where: { tissBatchId: batch.id },
  });

  const { xml, hash } = buildTissBatchXml({
    tissVersion: batchInsurer.tissVersion,
    ansRegistration: batchInsurer.ansRegistration,
    providerDocument: org.documentNumber,
    providerCodeAtInsurer: batchInsurer.providerCodeAtInsurer,
    providerCnes: "1234567",
    batchNumber,
    competence,
    guides: batchGuideRecords.map((g) => ({
      guideType: g.guideType,
      payload: g.payload as TissGuidePayload,
    })),
  });

  await prisma.tissBatch.update({
    where: { id: batch.id },
    data: { xmlHash: hash, xmlStorageKey: `tiss-seed/${batch.id}.xml`, status: "ENVIADO" },
  });
  void xml;
  void userId;

  const totalCents = batchGuideRecords.reduce((s, g) => s + g.totalValueCents, 0);
  const receivable = await prisma.receivable.create({
    data: {
      organizationId: orgId,
      patientId: patients[0]!.id,
      healthInsurerId: batchInsurer.id,
      tissBatchId: batch.id,
      origin: "TISS_BATCH",
      description: `Lote TISS #${batchNumber}`,
      totalCents,
      dueDate: new Date(),
    },
  });

  const glosaGuide = batchGuideRecords.find((g) => g.status === "GLOSADA_PARCIAL");
  const payment = await prisma.insurerPayment.create({
    data: {
      organizationId: orgId,
      healthInsurerId: batchInsurer.id,
      tissBatchId: batch.id,
      paymentDate: new Date(),
      grossAmountCents: totalCents,
      discountCents: 0,
      netAmountCents: totalCents - (glosaGuide ? 3000 : 0),
      guidePayments: batchGuideRecords.map((g) => ({
        guideId: g.id,
        paidCents: g.id === glosaGuide?.id ? g.totalValueCents - 3000 : g.totalValueCents,
        glosedCents: g.id === glosaGuide?.id ? 3000 : 0,
      })),
    },
  });

  if (glosaGuide) {
    await prisma.glosaItem.create({
      data: {
        organizationId: orgId,
        tissGuideId: glosaGuide.id,
        insurerPaymentId: payment.id,
        tussProcedureCode: "10101012",
        glosaReasonCode: "1005",
        glosedAmountCents: 3000,
        status: "EM_RECURSO",
        appealJustification: "Valor conforme tabela contratada vigente.",
        appealDeadline: new Date(Date.now() + 30 * 86400000),
      },
    });
  }

  await prisma.tissBatch.update({
    where: { id: batch.id },
    data: { status: "CONCILIADO" },
  });

  await prisma.receivable.update({
    where: { id: receivable.id },
    data: {
      paidCents: payment.netAmountCents,
      status: "PARCIAL",
    },
  });
}
