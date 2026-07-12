import type { PrescriptionType } from "@/generated/prisma/client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { encryptPHI, decryptPHI } from "@/lib/crypto/phi";
import { logRecordAccess } from "./record-access.service";
import { assertEncounterMutable } from "./encounter.service";
import { signClinicalDocument } from "./clinical-signature.service";
import { generatePrescriptionPdf } from "./pdf.service";
import { checkPrescriptionSafety } from "./prescription-safety.service";
import {
  allocateControlBookNumber,
  buildCfmValidationUrl,
  generatePrescriptionValidationCode,
  getOrCreatePrescriptionSettings,
} from "./prescription-settings.service";
import { releaseDocument } from "@/modules/engagement/services/campaign.service";
import { sendPrescriptionToPatient } from "./prescription-delivery.service";

export class PrescriptionSafetyError extends Error {
  constructor(
    message: string,
    public alerts: Awaited<ReturnType<typeof checkPrescriptionSafety>>["alerts"],
  ) {
    super(message);
    this.name = "PrescriptionSafetyError";
  }
}

export type PrescriptionItemInput = {
  drugCatalogId?: string | null;
  drugName: string;
  concentration?: string | null;
  pharmaceuticalForm?: string | null;
  dosage: string;
  route?: string | null;
  duration?: string | null;
  quantity?: string | null;
};

export async function createPrescription(
  db: TenantClient,
  organizationId: string,
  userId: string,
  userName: string,
  input: {
    encounterId: string;
    type?: PrescriptionType;
    notes?: string | null;
    items: PrescriptionItemInput[];
    confirmSafetyOverride?: boolean;
  },
) {
  const encounter = await db.encounter.findFirstOrThrow({
    where: { id: input.encounterId },
    include: { patient: true, professional: true },
  });
  assertEncounterMutable(encounter.status);

  const settings = await getOrCreatePrescriptionSettings(db, organizationId);
  const safety = await checkPrescriptionSafety(
    db,
    organizationId,
    encounter.patientId,
    input.items,
  );

  if (safety.blocking && !input.confirmSafetyOverride) {
    throw new PrescriptionSafetyError(
      "Alertas de segurança bloqueantes — confirme para prosseguir",
      safety.alerts,
    );
  }

  const prescriptionType = input.type ?? "COMUM";
  const validationCode = generatePrescriptionValidationCode();
  const validationUrl = buildCfmValidationUrl(validationCode);
  const controlBookNumber =
    prescriptionType === "CONTROLE_ESPECIAL"
      ? await allocateControlBookNumber(db, organizationId, encounter.professionalId)
      : null;

  const prescription = await db.prescription.create({
    data: {
      organizationId,
      encounterId: input.encounterId,
      patientId: encounter.patientId,
      professionalId: encounter.professionalId,
      authorUserId: userId,
      type: prescriptionType,
      provider: settings.provider,
      validationCode,
      validationUrl,
      controlBookNumber,
      notesEncrypted: input.notes ? encryptPHI(input.notes) : null,
      signedAt: new Date(),
      items: {
        create: input.items.map((item, i) => ({
          organizationId,
          drugCatalogId: item.drugCatalogId ?? null,
          drugName: item.drugName,
          concentration: item.concentration ?? null,
          pharmaceuticalForm: item.pharmaceuticalForm ?? null,
          dosage: item.dosage,
          route: item.route ?? null,
          duration: item.duration ?? null,
          quantity: item.quantity ?? null,
          sortOrder: i,
        })),
      },
    },
    include: { items: true },
  });

  const org = await db.organization.findFirstOrThrow({ where: { id: organizationId } });
  const pdfBuffer = generatePrescriptionPdf({
    header: {
      orgName: org.name,
      professionalName: encounter.professional.displayName,
      council: encounter.professional.councilType ?? undefined,
      councilNumber: encounter.professional.councilNumber ?? undefined,
      councilState: encounter.professional.councilState ?? undefined,
    },
    patientName: encounter.patient.socialName ?? encounter.patient.fullName,
    type: prescription.type,
    items: prescription.items,
    date: new Date(),
    validationCode,
    validationUrl,
    controlBookNumber,
  });

  const signOutcome = await signClinicalDocument({
    db,
    organizationId,
    userId,
    userName,
    entityType: "PRESCRIPTION",
    entityId: prescription.id,
    canonicalContent: JSON.stringify({
      prescriptionId: prescription.id,
      type: prescription.type,
      validationCode,
      items: prescription.items,
    }),
    pdfBuffer,
    auditMeta: {
      safetyAlerts: safety.alerts.length,
      returnPath: `/app/atendimento/${encounter.id}`,
    },
  });

  if (signOutcome.kind === "lacuna_redirect") {
    return {
      prescription,
      safetyAlerts: safety.alerts,
      redirectUrl: signOutcome.redirectUrl,
    };
  }

  await releaseDocument({
    organizationId,
    patientId: encounter.patientId,
    documentType: "PRESCRIPTION",
    prescriptionId: prescription.id,
    releasedByUserId: userId,
    autoReleased: true,
  });

  if (settings.autoSendToPatient) {
    try {
      await sendPrescriptionToPatient(db, organizationId, prescription.id);
    } catch {
      // envio opcional — não bloqueia prescrição
    }
  }

  return { prescription, safetyAlerts: safety.alerts };
}

export async function getPrescription(
  db: TenantClient,
  organizationId: string,
  prescriptionId: string,
  userId: string,
  accessMeta?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const prescription = await db.prescription.findFirstOrThrow({
    where: { id: prescriptionId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      encounter: {
        include: {
          patient: { select: { fullName: true, socialName: true } },
          professional: true,
        },
      },
    },
  });

  await logRecordAccess({
    organizationId,
    userId,
    resourceType: "PRESCRIPTION",
    resourceId: prescriptionId,
    ipAddress: accessMeta?.ipAddress,
    userAgent: accessMeta?.userAgent,
    metadata: { patientId: prescription.patientId },
  });

  return {
    ...prescription,
    notes: prescription.notesEncrypted
      ? decryptPHI(prescription.notesEncrypted)
      : null,
  };
}

export async function repeatPrescription(
  db: TenantClient,
  organizationId: string,
  userId: string,
  userName: string,
  sourcePrescriptionId: string,
  targetEncounterId?: string,
) {
  const source = await db.prescription.findFirstOrThrow({
    where: { id: sourcePrescriptionId },
    include: { items: true },
  });

  return createPrescription(db, organizationId, userId, userName, {
    encounterId: targetEncounterId ?? source.encounterId,
    type: source.type,
    items: source.items.map((i) => ({
      drugCatalogId: i.drugCatalogId,
      drugName: i.drugName,
      concentration: i.concentration,
      pharmaceuticalForm: i.pharmaceuticalForm,
      dosage: i.dosage,
      route: i.route,
      duration: i.duration,
      quantity: i.quantity,
    })),
    confirmSafetyOverride: true,
  });
}

export async function listPatientPrescriptions(
  db: TenantClient,
  patientId: string,
) {
  return db.prescription.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      encounter: { select: { startedAt: true, specialty: true } },
    },
  });
}
