import type {
  Allergy,
  ChronicCondition,
  Patient,
  PatientConsent,
  PatientDocument,
  PatientGuardian,
  PatientInsurancePlan,
  PatientMedication,
} from "@/generated/prisma/client";
import { decryptPHI, encryptPHI } from "@/lib/crypto/phi";
import {
  hashCpf,
  normalizePhone,
  normalizeSearchName,
} from "@/lib/crypto/search-hash";
import { redactThirdPartyText } from "@/lib/security/text-redact";
import type { TenantClient } from "@/lib/db/tenant-client";
import type {
  PatientContactInput,
  PatientPersonalInput,
  QuickPatientInput,
} from "@/modules/patients/schemas/patient.schema";

export type PatientAddress = {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

export type PatientPhone = {
  number: string;
  label?: string;
  isWhatsApp?: boolean;
};

export type DecryptedPatient = {
  id: string;
  fullName: string;
  socialName: string | null;
  cpf: string | null;
  rg: string | null;
  birthDate: Date | null;
  sex: Patient["sex"];
  genderIdentity: string | null;
  maritalStatus: Patient["maritalStatus"];
  profession: string | null;
  phones: PatientPhone[];
  email: string | null;
  address: PatientAddress | null;
  photoUrl: string | null;
  notes: string | null;
  referralSource: string | null;
  tags: string[];
  isIncomplete: boolean;
  isActive: boolean;
  anonymizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function encryptOptional(value: string | undefined | null): string | null {
  if (!value?.trim()) return null;
  return encryptPHI(value.trim());
}

function decryptOptional(value: string | null | undefined): string | null {
  if (!value) return null;
  return decryptPHI(value);
}

function encryptJson<T>(value: T | undefined | null): string | null {
  if (!value) return null;
  return encryptPHI(JSON.stringify(value));
}

function decryptJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(decryptPHI(value)) as T;
  } catch {
    return null;
  }
}

export function decryptPatientRecord(patient: Patient): DecryptedPatient {
  return {
    id: patient.id,
    fullName: patient.fullName,
    socialName: patient.socialName,
    cpf: decryptOptional(patient.cpfEncrypted),
    rg: decryptOptional(patient.rgEncrypted),
    birthDate: patient.birthDate,
    sex: patient.sex,
    genderIdentity: patient.genderIdentity,
    maritalStatus: patient.maritalStatus,
    profession: patient.profession,
    phones: decryptJson<PatientPhone[]>(patient.phonesEncrypted) ?? [],
    email: decryptOptional(patient.emailEncrypted),
    address: decryptJson<PatientAddress>(patient.addressEncrypted),
    photoUrl: patient.photoUrl,
    notes: decryptOptional(patient.notesEncrypted),
    referralSource: patient.referralSource,
    tags: patient.tags,
    isIncomplete: patient.isIncomplete,
    isActive: patient.isActive,
    anonymizedAt: patient.anonymizedAt,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  };
}

function buildPhoneSearch(phones: PatientPhone[]): string | null {
  const primary = phones[0]?.number;
  if (!primary) return null;
  const normalized = normalizePhone(primary);
  return normalized.length >= 8 ? normalized : null;
}

function buildPatientDbData(
  organizationId: string,
  personal: PatientPersonalInput,
  contact?: PatientContactInput,
) {
  const phones = contact?.phones ?? [];

  return {
    searchName: normalizeSearchName(personal.fullName),
    fullName: personal.fullName.trim(),
    socialName: personal.socialName?.trim() || null,
    cpfEncrypted: personal.cpf ? encryptPHI(personal.cpf) : null,
    cpfHash: personal.cpf ? hashCpf(personal.cpf, organizationId) : null,
    rgEncrypted: encryptOptional(personal.rg),
    birthDate: personal.birthDate ? new Date(personal.birthDate) : null,
    sex: personal.sex ?? null,
    genderIdentity: personal.genderIdentity?.trim() || null,
    maritalStatus: personal.maritalStatus ?? null,
    profession: personal.profession?.trim() || null,
    phonesEncrypted: phones.length > 0 ? encryptJson(phones) : null,
    phoneSearch: buildPhoneSearch(phones),
    emailEncrypted: encryptOptional(contact?.email),
    addressEncrypted: contact?.address ? encryptJson(contact.address) : null,
    notesEncrypted: encryptOptional(personal.notes),
    referralSource: personal.referralSource?.trim() || null,
    tags: personal.tags ?? [],
    isActive: personal.isActive ?? true,
    isIncomplete: false,
  };
}

export async function createQuickPatient(
  db: TenantClient,
  organizationId: string,
  input: QuickPatientInput,
) {
  const phones = [{ number: input.phone, label: "Principal" }];
  return db.patient.create({
    data: {
      organizationId,
      searchName: normalizeSearchName(input.fullName),
      fullName: input.fullName.trim(),
      phonesEncrypted: encryptJson(phones),
      phoneSearch: buildPhoneSearch(phones),
      isIncomplete: true,
      isActive: true,
    },
  });
}

export async function createFullPatient(
  db: TenantClient,
  organizationId: string,
  personal: PatientPersonalInput,
  contact?: PatientContactInput,
) {
  return db.patient.create({
    data: { organizationId, ...buildPatientDbData(organizationId, personal, contact) },
  });
}

export async function updatePatientPersonal(
  db: TenantClient,
  organizationId: string,
  patientId: string,
  personal: PatientPersonalInput,
) {
  return db.patient.update({
    where: { id: patientId },
    data: {
      searchName: normalizeSearchName(personal.fullName),
      fullName: personal.fullName.trim(),
      socialName: personal.socialName?.trim() || null,
      cpfEncrypted: personal.cpf ? encryptPHI(personal.cpf) : null,
      cpfHash: personal.cpf ? hashCpf(personal.cpf, organizationId) : null,
      rgEncrypted: encryptOptional(personal.rg),
      birthDate: personal.birthDate ? new Date(personal.birthDate) : null,
      sex: personal.sex ?? null,
      genderIdentity: personal.genderIdentity?.trim() || null,
      maritalStatus: personal.maritalStatus ?? null,
      profession: personal.profession?.trim() || null,
      notesEncrypted: encryptOptional(personal.notes),
      referralSource: personal.referralSource?.trim() || null,
      tags: personal.tags ?? [],
      isActive: personal.isActive ?? true,
      isIncomplete: false,
    },
  });
}

export async function updatePatientContact(
  db: TenantClient,
  patientId: string,
  contact: PatientContactInput,
) {
  const phones = contact.phones ?? [];
  return db.patient.update({
    where: { id: patientId },
    data: {
      phonesEncrypted: phones.length > 0 ? encryptJson(phones) : null,
      phoneSearch: buildPhoneSearch(phones),
      emailEncrypted: encryptOptional(contact.email),
      addressEncrypted: contact.address ? encryptJson(contact.address) : null,
      isIncomplete: false,
    },
  });
}

export async function getPatientById(db: TenantClient, patientId: string) {
  return db.patient.findFirst({
    where: { id: patientId },
    include: {
      guardians: { where: { deletedAt: null } },
      insurancePlans: { where: { deletedAt: null } },
      consents: { where: { deletedAt: null }, orderBy: { grantedAt: "desc" } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      allergies: { where: { deletedAt: null } },
      chronicConditions: { where: { deletedAt: null } },
      medications: { where: { deletedAt: null } },
    },
  });
}

export type PatientListFilters = {
  organizationId: string;
  branchId?: string | null;
  query?: string;
  tag?: string;
  insurer?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "fullName" | "createdAt" | "birthDate";
  sortOrder?: "asc" | "desc";
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export async function searchPatients(
  db: TenantClient,
  filters: PatientListFilters,
) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const skip = (page - 1) * pageSize;
  const query = filters.query?.trim();

  const where: Record<string, unknown> = {};

  if (!filters.includeInactive) {
    where.isActive = true;
  }

  if (filters.tag) {
    where.tags = { has: filters.tag };
  }

  if (query) {
    const digits = digitsOnly(query);
    const normalizedName = normalizeSearchName(query);

    const orConditions: Record<string, unknown>[] = [
      { searchName: { contains: normalizedName, mode: "insensitive" } },
      { fullName: { contains: query, mode: "insensitive" } },
    ];

    if (digits.length === 11) {
      orConditions.push({
        cpfHash: hashCpf(digits, filters.organizationId),
      });
    }

    if (digits.length >= 8) {
      orConditions.push({ phoneSearch: { contains: digits } });
    }

    if (digits.length >= 4) {
      const plans = await db.patientInsurancePlan.findMany({
        where: { cardNumberSearch: { contains: digits } },
        select: { patientId: true },
      });
      const cardPatientIds = plans.map((p) => p.patientId);
      if (cardPatientIds.length > 0) {
        orConditions.push({ id: { in: cardPatientIds } });
      }
    }

    where.OR = orConditions;
  }

  if (filters.insurer) {
    const plans = await db.patientInsurancePlan.findMany({
      where: {
        insurerName: { contains: filters.insurer, mode: "insensitive" },
      },
      select: { patientId: true },
    });
    const patientIds = Array.from(new Set(plans.map((p) => p.patientId)));
    where.id = { in: patientIds.length > 0 ? patientIds : ["__none__"] };
  }

  if (filters.branchId) {
    const [apptRows, leadRows] = await Promise.all([
      db.appointment.findMany({
        where: { branchId: filters.branchId },
        select: { patientId: true },
        distinct: ["patientId"],
      }),
      db.lead.findMany({
        where: { branchId: filters.branchId, patientId: { not: null } },
        select: { patientId: true },
      }),
    ]);
    const branchPatientIds = Array.from(
      new Set([
        ...apptRows.map((a) => a.patientId),
        ...leadRows.map((l) => l.patientId!).filter(Boolean),
      ]),
    );
    const existingId = where.id as { in: string[] } | undefined;
    if (existingId?.in) {
      const set = new Set(branchPatientIds);
      where.id = { in: existingId.in.filter((id) => set.has(id)) };
      if ((where.id as { in: string[] }).in.length === 0) {
        where.id = { in: ["__none__"] };
      }
    } else {
      where.id = { in: branchPatientIds.length > 0 ? branchPatientIds : ["__none__"] };
    }
  }

  const sortField = filters.sortBy ?? "fullName";
  const sortOrder = filters.sortOrder ?? "asc";

  const [items, total] = await Promise.all([
    db.patient.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip,
      take: pageSize,
      include: {
        insurancePlans: {
          where: { deletedAt: null, isPrimary: true },
          take: 1,
        },
      },
    }),
    db.patient.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function findDuplicatesForInput(
  db: TenantClient,
  organizationId: string,
  input: { cpf?: string; fullName?: string; birthDate?: string },
  excludePatientId?: string,
) {
  const matches: Patient[] = [];

  if (input.cpf) {
    const byCpf = await db.patient.findFirst({
      where: {
        cpfHash: hashCpf(input.cpf, organizationId),
        ...(excludePatientId ? { id: { not: excludePatientId } } : {}),
      },
    });
    if (byCpf) matches.push(byCpf);
  }

  if (input.fullName && input.birthDate) {
    const byNameBirth = await db.patient.findMany({
      where: {
        searchName: normalizeSearchName(input.fullName),
        birthDate: new Date(input.birthDate),
        ...(excludePatientId ? { id: { not: excludePatientId } } : {}),
      },
    });
    for (const p of byNameBirth) {
      if (!matches.some((m) => m.id === p.id)) matches.push(p);
    }
  }

  return matches.map(decryptPatientRecord);
}

export async function getPatientTimeline(db: TenantClient, patientId: string) {
  return db.auditLog.findMany({
    where: { entityType: "Patient", entityId: patientId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { id: true, name: true } } },
  });
}

export async function findDuplicateCandidates(db: TenantClient) {
  const patients = await db.patient.findMany({
    where: { anonymizedAt: null },
    orderBy: { fullName: "asc" },
  });

  const groups: Array<{
    reason: "cpf" | "name_birth";
    patients: Patient[];
  }> = [];

  const byCpf = new Map<string, Patient[]>();
  for (const p of patients) {
    if (p.cpfHash) {
      const list = byCpf.get(p.cpfHash) ?? [];
      list.push(p);
      byCpf.set(p.cpfHash, list);
    }
  }
  for (const [, list] of Array.from(byCpf.entries())) {
    if (list.length > 1) {
      groups.push({ reason: "cpf", patients: list });
    }
  }

  const cpfDuplicateIds = new Set(
    groups.flatMap((g) => g.patients.map((p) => p.id)),
  );

  const byNameBirth = new Map<string, Patient[]>();
  for (const p of patients) {
    if (p.birthDate && !cpfDuplicateIds.has(p.id)) {
      const key = `${p.searchName}:${p.birthDate.toISOString().slice(0, 10)}`;
      const list = byNameBirth.get(key) ?? [];
      list.push(p);
      byNameBirth.set(key, list);
    }
  }
  for (const [, list] of Array.from(byNameBirth.entries())) {
    if (list.length > 1) {
      groups.push({ reason: "name_birth", patients: list });
    }
  }

  return groups;
}

export async function getBirthdayPatients(
  db: TenantClient,
  range: "today" | "week",
) {
  const patients = await db.patient.findMany({
    where: { isActive: true, birthDate: { not: null }, anonymizedAt: null },
    orderBy: { fullName: "asc" },
  });

  const now = new Date();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();

  return patients.filter((p) => {
    if (!p.birthDate) return false;
    const month = p.birthDate.getMonth();
    const date = p.birthDate.getDate();

    if (range === "today") {
      return month === todayMonth && date === todayDate;
    }

    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      if (month === d.getMonth() && date === d.getDate()) return true;
    }
    return false;
  });
}

export async function anonymizePatient(db: TenantClient, patientId: string) {
  return db.patient.update({
    where: { id: patientId },
    data: {
      fullName: "Paciente Anonimizado",
      searchName: "paciente anonimizado",
      socialName: null,
      cpfEncrypted: null,
      cpfHash: null,
      rgEncrypted: null,
      phonesEncrypted: null,
      phoneSearch: null,
      emailEncrypted: null,
      addressEncrypted: null,
      notesEncrypted: null,
      photoUrl: null,
      isActive: false,
      anonymizedAt: new Date(),
      deletedAt: new Date(),
    },
  });
}

export function decryptGuardian(g: PatientGuardian) {
  return {
    ...g,
    cpf: decryptOptional(g.cpfEncrypted),
    phone: decryptOptional(g.phoneEncrypted),
  };
}

export function decryptInsurancePlan(p: PatientInsurancePlan) {
  return {
    ...p,
    cardNumber: decryptPHI(p.cardNumberEncrypted),
  };
}

export function decryptAllergy(a: Allergy) {
  return { ...a, notes: decryptOptional(a.notesEncrypted) };
}

export function decryptChronicCondition(c: ChronicCondition) {
  return { ...c, notes: decryptOptional(c.notesEncrypted) };
}

export function decryptMedication(m: PatientMedication) {
  return { ...m, notes: decryptOptional(m.notesEncrypted) };
}

export type LgpdExportData = {
  exportedAt: string;
  patient: DecryptedPatient;
  guardians: ReturnType<typeof decryptGuardian>[];
  insurancePlans: ReturnType<typeof decryptInsurancePlan>[];
  consents: PatientConsent[];
  documents: Pick<PatientDocument, "id" | "fileName" | "category" | "createdAt">[];
  allergies: ReturnType<typeof decryptAllergy>[];
  chronicConditions: ReturnType<typeof decryptChronicCondition>[];
  medications: ReturnType<typeof decryptMedication>[];
};

export function buildLgpdExport(
  patient: NonNullable<Awaited<ReturnType<typeof getPatientById>>>,
): LgpdExportData {
  const decrypted = decryptPatientRecord(patient);
  return {
    exportedAt: new Date().toISOString(),
    patient: {
      ...decrypted,
      notes: redactThirdPartyText(decrypted.notes),
    },
    guardians: patient.guardians.map(decryptGuardian),
    insurancePlans: patient.insurancePlans.map(decryptInsurancePlan),
    consents: patient.consents,
    documents: patient.documents.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      category: d.category,
      createdAt: d.createdAt,
    })),
    allergies: patient.allergies.map((a) => {
      const d = decryptAllergy(a);
      return { ...d, notes: redactThirdPartyText(d.notes) };
    }),
    chronicConditions: patient.chronicConditions.map((c) => {
      const d = decryptChronicCondition(c);
      return { ...d, notes: redactThirdPartyText(d.notes) };
    }),
    medications: patient.medications.map((m) => {
      const d = decryptMedication(m);
      return { ...d, notes: redactThirdPartyText(d.notes) };
    }),
  };
}

export function encryptCardNumber(cardNumber: string): {
  encrypted: string;
  search: string;
} {
  const normalized = cardNumber.replace(/\s/g, "");
  return {
    encrypted: encryptPHI(normalized),
    search: normalized.replace(/\D/g, "").slice(-6),
  };
}
