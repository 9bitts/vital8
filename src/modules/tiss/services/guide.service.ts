import type {
  TissAccidentIndication,
  TissConsultationType,
  TissGuideType,
  TissServiceCharacter,
} from "@/generated/prisma/client";
import { decryptPHI } from "@/lib/crypto/phi";
import { adminPrisma } from "@/lib/db/admin-client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { nextSequenceNumber } from "@/lib/tiss/sequence";
import type { TissGuidePayload, TissProcedureLine } from "@/lib/tiss/types";
import { validateGuideFields } from "@/lib/tiss/validator";
import { consumeAuthorization, findValidAuthorization } from "./authorization.service";
import { resolveInsurerPriceCents } from "./insurer.service";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTime(d: Date): string {
  return d.toISOString().slice(11, 19);
}

function competenceFromDate(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function extractCidFromEncounter(
  sections: Array<{ sectionType: string; structuredData: unknown }>,
): string | null {
  const diag = sections.find((s) => s.sectionType === "HIPOTESE_DIAGNOSTICA");
  if (!diag?.structuredData) return null;
  const data = diag.structuredData as { cidCodes?: string[] };
  return data.cidCodes?.[0] ?? null;
}

function mapAccident(code: TissAccidentIndication): string {
  const map: Record<TissAccidentIndication, string> = {
    NAO_ACIDENTE: "0",
    ACIDENTE_TRABALHO: "1",
    ACIDENTE_TRANSITO: "2",
    OUTROS_ACIDENTES: "9",
  };
  return map[code];
}

function mapCharacter(code: TissServiceCharacter): string {
  return code === "URGENCIA" ? "2" : "1";
}

function mapConsultType(code: TissConsultationType): string {
  const map: Record<TissConsultationType, string> = {
    PRIMEIRA: "1",
    SEGUIMENTO: "2",
    PRE_NATAL: "3",
    REFERENCIADA: "4",
  };
  return map[code];
}

export async function generateGuideFromAppointment(
  db: TenantClient,
  organizationId: string,
  appointmentId: string,
) {
  const existing = await db.tissGuide.findFirst({ where: { appointmentId } });
  if (existing) return existing;

  const appointment = await db.appointment.findFirstOrThrow({
    where: { id: appointmentId },
    include: {
      patient: true,
      professional: true,
      service: { include: { tussProcedure: true } },
      patientInsurancePlan: { include: { healthInsurer: true } },
      encounter: { include: { sections: true } },
      organization: true,
    },
  });

  if (appointment.isPrivate) return null;
  if (!appointment.patientInsurancePlan?.healthInsurer) {
    throw new Error("Convênio sem operadora vinculada");
  }

  const insurer = appointment.patientInsurancePlan.healthInsurer;
  const org = appointment.organization;
  const settings = org.settings as Record<string, unknown>;
  const cnes = (settings.cnes as string) ?? null;

  const tussCode =
    appointment.service.tussCode ??
    appointment.service.tussProcedure?.code ??
    null;
  const tussTerm =
    appointment.service.tussProcedure?.term ?? appointment.service.name;

  const priceCents = await resolveInsurerPriceCents(
    db,
    insurer.id,
    appointment.serviceId,
  );
  if (priceCents === null) {
    throw new Error("Preço do convênio não encontrado na tabela vinculada");
  }

  const executedAt = appointment.finishedAt ?? new Date();
  const procLine: TissProcedureLine = {
    tussCode: tussCode ?? "",
    term: tussTerm,
    quantity: 1,
    unitValueCents: priceCents,
    totalValueCents: priceCents,
    executionDate: formatDate(executedAt),
  };

  const cardNumber = decryptPHI(appointment.patientInsurancePlan.cardNumberEncrypted);
  const cid10 = appointment.encounter
    ? extractCidFromEncounter(appointment.encounter.sections)
    : null;

  const guideType: TissGuideType =
    appointment.service.category?.toLowerCase().includes("consulta")
      ? "GUIA_CONSULTA"
      : "GUIA_SP_SADT";

  const consultationType: TissConsultationType = "PRIMEIRA";
  const accidentIndication: TissAccidentIndication = "NAO_ACIDENTE";
  const serviceCharacter: TissServiceCharacter = "ELETIVO";

  let priorAuthorizationId: string | null = null;
  let authPassword: string | undefined;
  let authorizationValid = !insurer.requiresAuthorization;

  if (insurer.requiresAuthorization) {
    const auth = await findValidAuthorization(
      db,
      insurer.id,
      appointment.patientId,
      appointment.serviceId,
    );
    authorizationValid = !!auth && auth.consumedQty < auth.authorizedQty;
    if (auth) {
      priorAuthorizationId = auth.id;
      authPassword = auth.password ?? undefined;
    }
  }

  const validationErrors = validateGuideFields(
    {
      guideType,
      beneficiaryCard: cardNumber,
      beneficiaryCardValidUntil: appointment.patientInsurancePlan.validUntil,
      beneficiaryName: appointment.patient.fullName,
      ansRegistration: insurer.ansRegistration,
      providerDocument: org.documentNumber,
      providerCnes: cnes,
      professionalName: appointment.professional.displayName,
      professionalCouncilNumber: appointment.professional.councilNumber,
      tussCode,
      requiresAuthorization: insurer.requiresAuthorization,
      authorizationValid,
      procedures: [{ tussCode: tussCode ?? "", quantity: 1, unitValueCents: priceCents }],
      consultationType,
    },
    insurer.tissVersion,
  );

  const guideNumber = await nextSequenceNumber(
    db,
    organizationId,
    insurer.id,
    "GUIDE",
  );

  const payload: TissGuidePayload = {
    registroANS: insurer.ansRegistration,
    numeroGuiaPrestador: String(guideNumber),
    dadosBeneficiario: {
      numeroCarteira: cardNumber,
      validadeCarteira: appointment.patientInsurancePlan.validUntil
        ? formatDate(appointment.patientInsurancePlan.validUntil)
        : undefined,
      nomeBeneficiario: appointment.patient.fullName,
    },
    dadosContratadoExecutante: {
      codigoCNES: cnes ?? undefined,
      cnpjContratado: org.documentType === "CNPJ" ? org.documentNumber : undefined,
      cpfContratado: org.documentType === "CPF" ? org.documentNumber : undefined,
    },
    profissionalExecutante: {
      nomeProfissional: appointment.professional.displayName,
      conselhoProfissional: appointment.professional.councilType ?? undefined,
      numeroConselho: appointment.professional.councilNumber ?? undefined,
      ufConselho: appointment.professional.councilState ?? undefined,
    },
    indicacaoAcidente: mapAccident(accidentIndication),
    caraterAtendimento: mapCharacter(serviceCharacter),
    tipoConsulta: mapConsultType(consultationType),
    procedimentos: [procLine],
    cid10: cid10 ?? undefined,
    dataAtendimento: formatDate(executedAt),
    horaAtendimento: formatTime(executedAt),
    senhaAutorizacao: authPassword,
  };

  const guide = await db.tissGuide.create({
    data: {
      organizationId,
      appointmentId,
      healthInsurerId: insurer.id,
      priorAuthorizationId,
      guideType,
      guideNumber,
      status: validationErrors.length === 0 ? "PRONTA" : "RASCUNHO",
      competence: competenceFromDate(executedAt),
      validationErrors,
      beneficiaryName: appointment.patient.fullName,
      beneficiaryCard: cardNumber,
      beneficiaryCardValidUntil: appointment.patientInsurancePlan.validUntil,
      ansRegistration: insurer.ansRegistration,
      providerCnes: cnes,
      providerDocument: org.documentNumber,
      providerCouncil: org.documentType,
      professionalName: appointment.professional.displayName,
      professionalCouncil: appointment.professional.councilType,
      professionalCouncilNumber: appointment.professional.councilNumber,
      professionalCouncilState: appointment.professional.councilState,
      accidentIndication,
      serviceCharacter,
      consultationType,
      cid10Code: cid10,
      procedures: [procLine],
      totalValueCents: priceCents,
      executedAt,
      payload,
    },
  });

  if (priorAuthorizationId) {
    await consumeAuthorization(db, priorAuthorizationId);
  }

  if (tussCode) {
    await adminPrisma.tussProcedure.findFirst({ where: { code: tussCode } });
  }

  return guide;
}

export async function listGuides(
  db: TenantClient,
  filters?: { competence?: string; healthInsurerId?: string; status?: string },
) {
  return db.tissGuide.findMany({
    where: {
      ...(filters?.competence ? { competence: filters.competence } : {}),
      ...(filters?.healthInsurerId ? { healthInsurerId: filters.healthInsurerId } : {}),
      ...(filters?.status ? { status: filters.status as never } : {}),
    },
    include: {
      healthInsurer: true,
      appointment: { include: { patient: true, professional: true } },
      tissBatch: true,
    },
    orderBy: [{ competence: "desc" }, { guideNumber: "desc" }],
  });
}

export async function updateGuideFields(
  db: TenantClient,
  guideId: string,
  fields: {
    consultationType?: TissConsultationType;
    cid10Code?: string;
    accidentIndication?: TissAccidentIndication;
    serviceCharacter?: TissServiceCharacter;
  },
) {
  const guide = await db.tissGuide.findFirstOrThrow({
    where: { id: guideId },
    include: { healthInsurer: true },
  });

  if (guide.status !== "RASCUNHO" && guide.status !== "PRONTA") {
    throw new Error("Guia não pode ser editada neste status");
  }

  const updated = await db.tissGuide.update({
    where: { id: guideId },
    data: {
      consultationType: fields.consultationType,
      cid10Code: fields.cid10Code,
      accidentIndication: fields.accidentIndication,
      serviceCharacter: fields.serviceCharacter,
    },
  });
  void updated;

  const validationErrors = validateGuideFields(
    {
      guideType: guide.guideType,
      beneficiaryCard: guide.beneficiaryCard,
      beneficiaryCardValidUntil: guide.beneficiaryCardValidUntil,
      beneficiaryName: guide.beneficiaryName,
      ansRegistration: guide.ansRegistration,
      providerDocument: guide.providerDocument,
      providerCnes: guide.providerCnes,
      professionalName: guide.professionalName,
      professionalCouncilNumber: guide.professionalCouncilNumber,
      tussCode: (guide.procedures as TissProcedureLine[])[0]?.tussCode,
      requiresAuthorization: guide.healthInsurer.requiresAuthorization,
      authorizationValid: !guide.healthInsurer.requiresAuthorization || !!guide.priorAuthorizationId,
      procedures: (guide.procedures as TissProcedureLine[]).map((p) => ({
        tussCode: p.tussCode,
        quantity: p.quantity,
        unitValueCents: p.unitValueCents,
      })),
      consultationType: fields.consultationType ?? guide.consultationType,
    },
    guide.healthInsurer.tissVersion,
  );

  return db.tissGuide.update({
    where: { id: guideId },
    data: {
      validationErrors,
      status: validationErrors.length === 0 ? "PRONTA" : "RASCUNHO",
    },
  });
}

export async function revalidateGuide(db: TenantClient, guideId: string) {
  const guide = await db.tissGuide.findFirstOrThrow({
    where: { id: guideId },
    include: { healthInsurer: true },
  });

  const procedures = guide.procedures as TissProcedureLine[];
  const validationErrors = validateGuideFields(
    {
      guideType: guide.guideType,
      beneficiaryCard: guide.beneficiaryCard,
      beneficiaryCardValidUntil: guide.beneficiaryCardValidUntil,
      beneficiaryName: guide.beneficiaryName,
      ansRegistration: guide.ansRegistration,
      providerDocument: guide.providerDocument,
      providerCnes: guide.providerCnes,
      professionalName: guide.professionalName,
      professionalCouncilNumber: guide.professionalCouncilNumber,
      tussCode: procedures[0]?.tussCode,
      requiresAuthorization: guide.healthInsurer.requiresAuthorization,
      authorizationValid: !guide.healthInsurer.requiresAuthorization || !!guide.priorAuthorizationId,
      procedures: procedures.map((p) => ({
        tussCode: p.tussCode,
        quantity: p.quantity,
        unitValueCents: p.unitValueCents,
      })),
      consultationType: guide.consultationType,
    },
    guide.healthInsurer.tissVersion,
  );

  return db.tissGuide.update({
    where: { id: guideId },
    data: {
      validationErrors,
      status: validationErrors.length === 0 ? "PRONTA" : "RASCUNHO",
    },
  });
}

export async function getGuideForPrint(db: TenantClient, guideId: string) {
  return db.tissGuide.findFirstOrThrow({
    where: { id: guideId },
    include: {
      healthInsurer: true,
      appointment: { include: { patient: true, professional: true, service: true } },
    },
  });
}
