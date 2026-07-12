import type { PrescriptionType } from "@/generated/prisma/client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { encryptPHI, decryptPHI } from "@/lib/crypto/phi";
import { logRecordAccess } from "./record-access.service";
import { assertEncounterMutable } from "./encounter.service";

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
  input: {
    encounterId: string;
    type?: PrescriptionType;
    notes?: string | null;
    items: PrescriptionItemInput[];
  },
) {
  const encounter = await db.encounter.findFirstOrThrow({
    where: { id: input.encounterId },
  });
  assertEncounterMutable(encounter.status);

  const prescription = await db.prescription.create({
    data: {
      organizationId,
      encounterId: input.encounterId,
      patientId: encounter.patientId,
      professionalId: encounter.professionalId,
      authorUserId: userId,
      type: input.type ?? "COMUM",
      notesEncrypted: input.notes ? encryptPHI(input.notes) : null,
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

  return prescription;
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
  sourcePrescriptionId: string,
  targetEncounterId?: string,
) {
  const source = await db.prescription.findFirstOrThrow({
    where: { id: sourcePrescriptionId },
    include: { items: true },
  });

  return createPrescription(db, organizationId, userId, {
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
