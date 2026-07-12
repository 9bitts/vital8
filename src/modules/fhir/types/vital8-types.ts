/** Tipos normalizados para round-trip Vital8 ↔ FHIR sem perda de campos essenciais. */

import type { Sex } from "@/generated/prisma/client";

export type Vital8Patient = {
  id: string;
  organizationId: string;
  fullName: string;
  socialName?: string | null;
  cpf?: string | null;
  cns?: string | null;
  birthDate?: string | null;
  sex?: Sex | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  updatedAt: string;
};

export type Vital8Professional = {
  id: string;
  organizationId: string;
  displayName: string;
  councilType?: string | null;
  councilNumber?: string | null;
  councilState?: string | null;
  specialties: string[];
  isActive: boolean;
  updatedAt: string;
};

export type Vital8Organization = {
  id: string;
  name: string;
  documentNumber: string;
  phone?: string | null;
  email?: string | null;
  updatedAt: string;
};

export type Vital8Location = {
  id: string;
  organizationId: string;
  name: string;
  cnes?: string | null;
  address?: Record<string, unknown>;
  isActive: boolean;
  updatedAt: string;
};

export type Vital8Appointment = {
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  serviceId: string;
  branchId?: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
};

export type Vital8Encounter = {
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  status: string;
  modality: string;
  specialty?: string | null;
  startedAt: string;
  endedAt?: string | null;
  signedAt?: string | null;
  contentHash?: string | null;
  updatedAt: string;
};

export type Vital8Condition = {
  id: string;
  patientId: string;
  cidCode: string;
  description?: string | null;
  updatedAt: string;
};

export type Vital8Allergy = {
  id: string;
  patientId: string;
  substance: string;
  severity?: string | null;
  updatedAt: string;
};

export type Vital8MedicationRequest = {
  id: string;
  patientId: string;
  encounterId: string;
  drugName: string;
  dosage?: string | null;
  route?: string | null;
  frequency?: string | null;
  quantity?: number | null;
  signedAt?: string | null;
  updatedAt: string;
};

export type Vital8Observation = {
  id: string;
  patientId: string;
  resultId: string;
  name: string;
  value: string;
  unit?: string | null;
  referenceRange?: string | null;
  resultedAt: string;
};

export type Vital8DiagnosticReport = {
  id: string;
  organizationId: string;
  patientId: string;
  requestId?: string | null;
  encounterId?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  resultedAt: string;
  observations: Vital8Observation[];
  updatedAt: string;
};

export type Vital8ServiceRequest = {
  id: string;
  organizationId: string;
  patientId: string;
  encounterId: string;
  authorUserId: string;
  items: Array<{ examName: string; instructions?: string | null }>;
  createdAt: string;
};

export type Vital8DocumentReference = {
  id: string;
  patientId: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  category: string;
  createdAt: string;
};

export type Vital8Immunization = {
  id: string;
  patientId: string;
  vaccineCode: string;
  vaccineDisplay: string;
  occurrenceDate: string;
};
