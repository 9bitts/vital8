import type { DecryptedPatient } from "@/modules/patients/services/patient.service";

export type PatientDto = {
  id: string;
  fullName: string;
  socialName: string | null;
  birthDate: string | null;
  sex: string | null;
  email: string | null;
  phones: { number: string; label?: string }[];
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function toPatientDto(p: DecryptedPatient): PatientDto {
  return {
    id: p.id,
    fullName: p.fullName,
    socialName: p.socialName,
    birthDate: p.birthDate?.toISOString().slice(0, 10) ?? null,
    sex: p.sex,
    email: p.email,
    phones: p.phones.map((ph) => ({ number: ph.number, label: ph.label })),
    tags: p.tags,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export type AppointmentDto = {
  id: string;
  patientId: string;
  professionalId: string;
  serviceId: string;
  roomId: string | null;
  branchId: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  origin: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toAppointmentDto(a: {
  id: string;
  patientId: string;
  professionalId: string;
  serviceId: string;
  roomId: string | null;
  branchId?: string | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
  origin: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AppointmentDto {
  return {
    id: a.id,
    patientId: a.patientId,
    professionalId: a.professionalId,
    serviceId: a.serviceId,
    roomId: a.roomId,
    branchId: a.branchId ?? null,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    status: a.status,
    origin: a.origin,
    notes: a.notes,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export type SlotDto = {
  startsAt: string;
  endsAt: string;
  roomId: string | null;
};

export function toSlotDto(s: { startsAt: Date; endsAt: Date; roomId?: string | null }): SlotDto {
  return {
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    roomId: s.roomId ?? null,
  };
}
