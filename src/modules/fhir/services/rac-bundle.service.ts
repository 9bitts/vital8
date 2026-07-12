import type { TenantClient } from "@/lib/db/tenant-client";
import { decryptPHI } from "@/lib/crypto/phi";
import { adminPrisma } from "@/lib/db/admin-client";
import {
  patientToFhir,
  practitionerToFhir,
  practitionerRoleToFhir,
  organizationToFhir,
  locationToFhir,
  encounterToFhir,
  conditionToFhir,
  allergyToFhir,
  medicationRequestToFhir,
  appointmentToFhir,
  createRacBundle,
} from "../mappers";
import type { FhirResourceBase } from "../types/fhir-types";
import type {
  Vital8Patient,
  Vital8Professional,
  Vital8Organization,
  Vital8Location,
  Vital8Encounter,
  Vital8Appointment,
  Vital8Condition,
  Vital8Allergy,
  Vital8MedicationRequest,
} from "../types/vital8-types";
import { assertValidFhirResource } from "../lib/validator";

function decryptPhones(encrypted?: string | null): string | null {
  if (!encrypted) return null;
  try {
    const parsed = JSON.parse(decryptPHI(encrypted)) as Array<{ number?: string }>;
    return parsed[0]?.number ?? null;
  } catch {
    return null;
  }
}

export async function buildRacBundleFromEncounter(
  db: TenantClient,
  organizationId: string,
  encounterId: string,
) {
  const encounter = await db.encounter.findFirstOrThrow({
    where: { id: encounterId, status: "ASSINADO" },
    include: {
      patient: true,
      professional: true,
      appointment: { include: { branch: true } },
      prescriptions: { include: { items: true } },
    },
  });

  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: organizationId },
  });

  const allergies = await db.allergy.findMany({
    where: { patientId: encounter.patientId },
  });
  const conditions = await db.chronicCondition.findMany({
    where: { patientId: encounter.patientId },
  });

  const sections = await db.encounterSection.findMany({
    where: { encounterId },
  });
  const cidFromSections: Vital8Condition[] = [];
  for (const section of sections) {
    const data = section.structuredData as { cidCodes?: string[] };
    if (data.cidCodes) {
      for (const code of data.cidCodes) {
        cidFromSections.push({
          id: `${section.id}-${code}`,
          patientId: encounter.patientId,
          cidCode: code,
          description: null,
          updatedAt: section.updatedAt.toISOString(),
        });
      }
    }
  }

  const vital8Patient: Vital8Patient = {
    id: encounter.patient.id,
    organizationId,
    fullName: encounter.patient.fullName,
    socialName: encounter.patient.socialName,
    cpf: encounter.patient.cpfEncrypted ? decryptPHI(encounter.patient.cpfEncrypted) : null,
    cns: encounter.patient.cnsEncrypted ? decryptPHI(encounter.patient.cnsEncrypted) : null,
    birthDate: encounter.patient.birthDate?.toISOString().slice(0, 10) ?? null,
    sex: encounter.patient.sex,
    phone: decryptPhones(encounter.patient.phonesEncrypted),
    email: encounter.patient.emailEncrypted ? decryptPHI(encounter.patient.emailEncrypted) : null,
    isActive: encounter.patient.isActive,
    updatedAt: encounter.patient.updatedAt.toISOString(),
  };

  const vital8Prof: Vital8Professional = {
    id: encounter.professional.id,
    organizationId,
    displayName: encounter.professional.displayName,
    councilType: encounter.professional.councilType,
    councilNumber: encounter.professional.councilNumber,
    councilState: encounter.professional.councilState,
    specialties: encounter.professional.specialties,
    isActive: encounter.professional.isActive,
    updatedAt: encounter.professional.updatedAt.toISOString(),
  };

  const vital8Org: Vital8Organization = {
    id: org.id,
    name: org.name,
    documentNumber: org.documentNumber,
    phone: org.phone,
    email: org.email,
    updatedAt: org.updatedAt.toISOString(),
  };

  const vital8Encounter: Vital8Encounter = {
    id: encounter.id,
    organizationId,
    patientId: encounter.patientId,
    professionalId: encounter.professionalId,
    appointmentId: encounter.appointmentId,
    status: encounter.status,
    modality: encounter.modality,
    specialty: encounter.specialty,
    startedAt: encounter.startedAt.toISOString(),
    endedAt: encounter.endedAt?.toISOString() ?? null,
    signedAt: encounter.signedAt?.toISOString() ?? null,
    contentHash: encounter.contentHash,
    updatedAt: encounter.updatedAt.toISOString(),
  };

  const resources: FhirResourceBase[] = [
    patientToFhir(vital8Patient),
    practitionerToFhir(vital8Prof),
    practitionerRoleToFhir(vital8Prof, organizationId),
    organizationToFhir(vital8Org),
    encounterToFhir(vital8Encounter),
  ];

  if (encounter.appointment?.branch) {
    const branch = encounter.appointment.branch;
    const loc: Vital8Location = {
      id: branch.id,
      organizationId,
      name: branch.name,
      cnes: branch.cnes,
      address: branch.address as Record<string, unknown>,
      isActive: branch.isActive,
      updatedAt: branch.updatedAt.toISOString(),
    };
    resources.push(locationToFhir(loc));
  }

  if (encounter.appointment) {
    const appt: Vital8Appointment = {
      id: encounter.appointment.id,
      organizationId,
      patientId: encounter.patientId,
      professionalId: encounter.professionalId,
      serviceId: encounter.appointment.serviceId,
      branchId: encounter.appointment.branchId,
      status: encounter.appointment.status,
      startsAt: encounter.appointment.startsAt.toISOString(),
      endsAt: encounter.appointment.endsAt.toISOString(),
      updatedAt: encounter.appointment.updatedAt.toISOString(),
    };
    resources.push(appointmentToFhir(appt));
  }

  for (const allergy of allergies) {
    const a: Vital8Allergy = {
      id: allergy.id,
      patientId: allergy.patientId,
      substance: allergy.substance,
      severity: allergy.severity,
      updatedAt: allergy.updatedAt.toISOString(),
    };
    resources.push(allergyToFhir(a));
  }

  for (const cond of conditions) {
    const c: Vital8Condition = {
      id: cond.id,
      patientId: cond.patientId,
      cidCode: cond.cidCode ?? cond.condition,
      description: cond.condition,
      updatedAt: cond.updatedAt.toISOString(),
    };
    resources.push(conditionToFhir(c));
  }

  for (const c of cidFromSections) {
    resources.push(conditionToFhir(c));
  }

  for (const rx of encounter.prescriptions) {
    for (const item of rx.items) {
      const m: Vital8MedicationRequest = {
        id: item.id,
        patientId: encounter.patientId,
        encounterId: encounter.id,
        drugName: item.drugName,
        dosage: item.dosage,
        route: item.route,
        frequency: item.duration,
        quantity: item.quantity ? parseFloat(item.quantity) || null : null,
        signedAt: rx.signedAt?.toISOString() ?? null,
        updatedAt: rx.updatedAt.toISOString(),
      };
      resources.push(medicationRequestToFhir(m));
    }
  }

  for (const r of resources) assertValidFhirResource(r);

  return createRacBundle(resources);
}

export async function buildExamResultBundle(
  db: TenantClient,
  organizationId: string,
  examResultId: string,
) {
  const result = await db.examResult.findFirstOrThrow({
    where: { id: examResultId },
    include: { values: true, patient: true, request: true },
  });

  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: organizationId },
  });

  const vital8Patient: Vital8Patient = {
    id: result.patient.id,
    organizationId,
    fullName: result.patient.fullName,
    socialName: result.patient.socialName,
    cpf: result.patient.cpfEncrypted ? decryptPHI(result.patient.cpfEncrypted) : null,
    cns: result.patient.cnsEncrypted ? decryptPHI(result.patient.cnsEncrypted) : null,
    birthDate: result.patient.birthDate?.toISOString().slice(0, 10) ?? null,
    sex: result.patient.sex,
    phone: null,
    email: null,
    isActive: result.patient.isActive,
    updatedAt: result.patient.updatedAt.toISOString(),
  };

  const { diagnosticReportWithObservations } = await import("../mappers/diagnostic-report.mapper");
  const { createExamResultBundle } = await import("../mappers/bundle.mapper");

  const report = {
    id: result.id,
    organizationId,
    patientId: result.patientId,
    requestId: result.requestId,
    encounterId: result.encounterId,
    fileName: result.fileName,
    mimeType: result.mimeType,
    resultedAt: result.resultedAt.toISOString(),
    observations: result.values.map((v) => ({
      id: v.id,
      patientId: result.patientId,
      resultId: result.id,
      name: v.name,
      value: v.value,
      unit: v.unit,
      referenceRange: v.referenceRange,
      resultedAt: result.resultedAt.toISOString(),
    })),
    updatedAt: result.createdAt.toISOString(),
  };

  const { report: dr, observations } = diagnosticReportWithObservations(report);
  const resources: FhirResourceBase[] = [
    patientToFhir(vital8Patient),
    organizationToFhir({
      id: org.id,
      name: org.name,
      documentNumber: org.documentNumber,
      phone: org.phone,
      email: org.email,
      updatedAt: org.updatedAt.toISOString(),
    }),
    dr,
    ...observations,
  ];

  for (const r of resources) assertValidFhirResource(r);
  return createExamResultBundle(resources);
}
