import type {
  Prisma,
  EncounterStatus,
  EncounterSectionType,
  Role,
} from "@/generated/prisma/client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { encryptPHI, decryptPHI } from "@/lib/crypto/phi";
import { getDigitalSignatureAdapter } from "@/lib/integrations/digital-signature";
import {
  buildCanonicalEncounter,
  computeEncounterContentHash,
} from "./integrity.service";
import { logRecordAccess } from "./record-access.service";
import { canViewRestrictedSection } from "../lib/permissions";
import { transitionAppointmentStatus } from "@/modules/scheduling/services/appointment.service";

export class EncounterImmutableError extends Error {
  constructor(message = "Encontro assinado é imutável") {
    super(message);
    this.name = "EncounterImmutableError";
  }
}

export function assertEncounterMutable(status: EncounterStatus): void {
  if (status === "ASSINADO") {
    throw new EncounterImmutableError();
  }
}

export type DecryptedSection = {
  id: string;
  sectionType: EncounterSectionType;
  content: string | null;
  structuredData: Record<string, unknown>;
  restrictedToAuthor: boolean;
  restrictedHidden: boolean;
  sortOrder: number;
};

export async function createEncounterFromAppointment(
  db: TenantClient,
  organizationId: string,
  userId: string,
  appointmentId: string,
  specialty?: string,
) {
  const existing = await db.encounter.findFirst({
    where: { appointmentId },
  });
  if (existing) return existing;

  const appointment = await db.appointment.findFirstOrThrow({
    where: { id: appointmentId },
    include: { service: true },
  });

  await transitionAppointmentStatus(
    db,
    organizationId,
    userId,
    appointmentId,
    "EM_ATENDIMENTO",
  );

  const encounter = await db.encounter.create({
    data: {
      organizationId,
      appointmentId,
      patientId: appointment.patientId,
      professionalId: appointment.professionalId,
      authorUserId: userId,
      specialty: specialty ?? appointment.service.category ?? "medicina_geral",
      startedAt: new Date(),
    },
  });

  const defaultSections = getDefaultSectionsForSpecialty(
    encounter.specialty ?? "medicina_geral",
  );

  for (let i = 0; i < defaultSections.length; i++) {
    const s = defaultSections[i];
    await db.encounterSection.create({
      data: {
        organizationId,
        encounterId: encounter.id,
        sectionType: s.type,
        restrictedToAuthor: s.restricted ?? false,
        sortOrder: i,
        structuredData: (s.structured ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  return encounter;
}

function getDefaultSectionsForSpecialty(specialty: string): Array<{
  type: EncounterSectionType;
  restricted?: boolean;
  structured?: Record<string, unknown>;
}> {
  switch (specialty) {
    case "odontologia":
      return [
        { type: "ANAMNESE" },
        { type: "EXAME_FISICO" },
        { type: "ODONTOGRAMA" },
        { type: "CONDUTA" },
      ];
    case "fisioterapia":
      return [
        { type: "EVOLUCAO_FISIO" },
        { type: "PLANO_TRATAMENTO", structured: { metas: [] } },
        { type: "CONDUTA" },
      ];
    case "psicologia":
      return [{ type: "REGISTRO_RESERVADO", restricted: true }];
    case "nutricao":
      return [
        { type: "ANAMNESE" },
        { type: "ANTROPOMETRIA", structured: { medidas: [] } },
        { type: "CONDUTA" },
      ];
    default:
      return [
        { type: "ANAMNESE" },
        {
          type: "EVOLUCAO_SOAP",
          structured: { subjective: "", objective: "", assessment: "", plan: "" },
        },
        { type: "HIPOTESE_DIAGNOSTICA", structured: { cidCodes: [] } },
        { type: "CONDUTA" },
      ];
  }
}

function decryptSectionContent(
  section: {
    id: string;
    sectionType: EncounterSectionType;
    contentEncrypted: string | null;
    structuredData: unknown;
    restrictedToAuthor: boolean;
    sortOrder: number;
  },
  authorUserId: string,
  viewerUserId: string,
  role: Role,
): DecryptedSection {
  const canView = canViewRestrictedSection(
    section.restrictedToAuthor,
    authorUserId,
    viewerUserId,
    role,
  );

  if (!canView) {
    return {
      id: section.id,
      sectionType: section.sectionType,
      content: null,
      structuredData: {},
      restrictedToAuthor: section.restrictedToAuthor,
      restrictedHidden: true,
      sortOrder: section.sortOrder,
    };
  }

  let content: string | null = null;
  if (section.contentEncrypted) {
    try {
      content = decryptPHI(section.contentEncrypted);
    } catch {
      content = null;
    }
  }

  return {
    id: section.id,
    sectionType: section.sectionType,
    content,
    structuredData: (section.structuredData as Record<string, unknown>) ?? {},
    restrictedToAuthor: section.restrictedToAuthor,
    restrictedHidden: false,
    sortOrder: section.sortOrder,
  };
}

export async function getEncounterDetail(
  db: TenantClient,
  organizationId: string,
  encounterId: string,
  viewerUserId: string,
  role: Role,
  accessMeta?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const encounter = await db.encounter.findFirstOrThrow({
    where: { id: encounterId },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      amendments: { orderBy: { createdAt: "asc" } },
      odontogram: { include: { entries: true } },
      bodyChartEntries: true,
      patient: {
        include: { allergies: true, chronicConditions: true },
      },
      professional: true,
      prescriptions: { include: { items: true } },
      examRequests: { include: { items: true } },
      examResults: { include: { values: true } },
      certificates: true,
    },
  });

  await logRecordAccess({
    organizationId,
    userId: viewerUserId,
    resourceType: "ENCOUNTER",
    resourceId: encounterId,
    ipAddress: accessMeta?.ipAddress,
    userAgent: accessMeta?.userAgent,
    metadata: { patientId: encounter.patientId },
  });

  const sections = encounter.sections.map((s) =>
    decryptSectionContent(
      s,
      encounter.authorUserId,
      viewerUserId,
      role,
    ),
  );

  const amendments = encounter.amendments.map((a) => {
    const canView = canViewRestrictedSection(
      false,
      encounter.authorUserId,
      viewerUserId,
      role,
    );
    return {
      id: a.id,
      authorUserId: a.authorUserId,
      createdAt: a.createdAt,
      content: canView ? decryptPHI(a.contentEncrypted) : "[Restrito]",
    };
  });

  const bodyChartEntries = encounter.bodyChartEntries.map((e) => ({
    id: e.id,
    x: e.x,
    y: e.y,
    label: e.label,
    note: e.noteEncrypted ? decryptPHI(e.noteEncrypted) : null,
  }));

  return {
    encounter: {
      ...encounter,
      bodyChartEntries,
    },
    sections,
    amendments,
  };
}

export async function updateEncounterSection(
  db: TenantClient,
  encounterId: string,
  sectionId: string,
  input: {
    content?: string | null;
    structuredData?: Record<string, unknown>;
  },
) {
  const encounter = await db.encounter.findFirstOrThrow({
    where: { id: encounterId },
  });
  assertEncounterMutable(encounter.status);

  const data: Prisma.EncounterSectionUpdateInput = {};
  if (input.content !== undefined) {
    data.contentEncrypted = input.content
      ? encryptPHI(input.content)
      : null;
  }
  if (input.structuredData !== undefined) {
    data.structuredData = input.structuredData as Prisma.InputJsonValue;
  }

  return db.encounterSection.update({
    where: { id: sectionId },
    data,
  });
}

export async function signEncounter(
  db: TenantClient,
  organizationId: string,
  userId: string,
  userName: string,
  encounterId: string,
) {
  const encounter = await db.encounter.findFirstOrThrow({
    where: { id: encounterId },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      amendments: true,
      odontogram: { include: { entries: true } },
      bodyChartEntries: true,
    },
  });

  if (encounter.status === "ASSINADO") {
    throw new Error("Encontro já assinado");
  }

  if (encounter.authorUserId !== userId) {
    throw new Error("Somente o profissional autor pode assinar");
  }

  const sectionsPlain = encounter.sections.map((s) => ({
    id: s.id,
    sectionType: s.sectionType,
    structuredData: s.structuredData,
    contentPlain: s.contentEncrypted
      ? decryptPHI(s.contentEncrypted)
      : null,
    restrictedToAuthor: s.restrictedToAuthor,
    sortOrder: s.sortOrder,
  }));

  const amendmentsPlain = encounter.amendments.map((a) => ({
    id: a.id,
    createdAt: a.createdAt,
    contentPlain: decryptPHI(a.contentEncrypted),
  }));

  const canonical = buildCanonicalEncounter({
    encounter,
    sections: sectionsPlain,
    amendments: amendmentsPlain,
    odontogramEntries: encounter.odontogram?.entries ?? [],
    bodyChartEntries: encounter.bodyChartEntries,
  });

  const contentHash = computeEncounterContentHash(canonical);
  const signature = await getDigitalSignatureAdapter().sign({
    userId,
    userName,
    contentHash,
    timestamp: new Date(),
  });

  const signed = await db.encounter.update({
    where: { id: encounterId },
    data: {
      status: "ASSINADO",
      contentHash,
      signedAt: signature.signedAt,
      endedAt: new Date(),
      signatureMeta: signature.metadata,
    },
  });

  if (encounter.appointmentId) {
    await transitionAppointmentStatus(
      db,
      organizationId,
      userId,
      encounter.appointmentId,
      "FINALIZADO",
    );
  }

  const { autoReleaseEncounterDocuments } = await import(
    "@/modules/engagement/services/campaign.service"
  );
  const { schedulePostEncounterNps } = await import(
    "@/modules/engagement/services/automation.service"
  );
  await autoReleaseEncounterDocuments(organizationId, encounterId);
  await schedulePostEncounterNps(organizationId, encounterId);

  return { encounter: signed, contentHash, signature };
}

export async function addEncounterAmendment(
  db: TenantClient,
  organizationId: string,
  userId: string,
  encounterId: string,
  content: string,
) {
  const encounter = await db.encounter.findFirstOrThrow({
    where: { id: encounterId },
  });

  if (encounter.status !== "ASSINADO") {
    throw new Error("Adendos só são permitidos em encontros assinados");
  }

  return db.encounterAmendment.create({
    data: {
      organizationId,
      encounterId,
      authorUserId: userId,
      contentEncrypted: encryptPHI(content),
    },
  });
}

export async function deleteEncounter(
  db: TenantClient,
  encounterId: string,
): Promise<void> {
  const encounter = await db.encounter.findFirstOrThrow({
    where: { id: encounterId },
  });
  assertEncounterMutable(encounter.status);
  throw new EncounterImmutableError(
    "Delete físico de encontros não é permitido",
  );
}

export async function listPatientEncounters(
  db: TenantClient,
  patientId: string,
  role: Role,
) {
  const encounters = await db.encounter.findMany({
    where: { patientId },
    orderBy: { startedAt: "desc" },
    include: {
      professional: { select: { displayName: true } },
    },
  });

  if (role === "RECEPCAO" || role === "LEITURA") {
    return encounters.map((e) => ({
      id: e.id,
      startedAt: e.startedAt,
      status: e.status,
      specialty: e.specialty,
      professionalName: e.professional.displayName,
      hasClinicalContent: true,
    }));
  }

  return encounters;
}
