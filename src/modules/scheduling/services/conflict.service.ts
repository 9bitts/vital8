import type { AppointmentStatus } from "@/generated/prisma/client";

export type TimeRange = {
  startsAt: Date;
  endsAt: Date;
};

export type ConflictResource = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  isSqueeze?: boolean;
};

/** Statuses that still occupy the calendar slot. */
export const OCCUPYING_STATUSES: AppointmentStatus[] = [
  "AGENDADO",
  "CONFIRMADO",
  "AGUARDANDO",
  "EM_ATENDIMENTO",
  "FINALIZADO",
];

export function appointmentsOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}

export function isOccupyingStatus(status: AppointmentStatus): boolean {
  return OCCUPYING_STATUSES.includes(status);
}

export type ConflictCheckInput = TimeRange & {
  professionalId: string;
  patientId: string;
  roomId?: string | null;
  excludeAppointmentId?: string;
  isSqueeze?: boolean;
};

export type ConflictResult = {
  hasConflict: boolean;
  professionalConflict: boolean;
  patientConflict: boolean;
  roomConflict: boolean;
  conflictingIds: string[];
};

export function detectConflicts(
  candidate: ConflictCheckInput,
  existing: ConflictResource[],
): ConflictResult {
  const relevant = existing.filter(
    (appt) =>
      appt.id !== candidate.excludeAppointmentId &&
      isOccupyingStatus(appt.status),
  );

  const range: TimeRange = {
    startsAt: candidate.startsAt,
    endsAt: candidate.endsAt,
  };

  const conflictingIds: string[] = [];

  for (const appt of relevant) {
    if (!appointmentsOverlap(range, appt)) continue;

    conflictingIds.push(appt.id);
  }

  return {
    hasConflict: conflictingIds.length > 0,
    professionalConflict: false,
    patientConflict: false,
    roomConflict: false,
    conflictingIds,
  };
}

export type TaggedAppointment = ConflictResource & {
  professionalId: string;
  patientId: string;
  roomId?: string | null;
};

export function detectResourceConflicts(
  candidate: ConflictCheckInput,
  existing: TaggedAppointment[],
): ConflictResult {
  const range: TimeRange = {
    startsAt: candidate.startsAt,
    endsAt: candidate.endsAt,
  };

  const conflictingIds: string[] = [];
  let professionalConflict = false;
  let patientConflict = false;
  let roomConflict = false;

  for (const appt of existing) {
    if (appt.id === candidate.excludeAppointmentId) continue;
    if (!isOccupyingStatus(appt.status)) continue;
    if (!appointmentsOverlap(range, appt)) continue;

    if (appt.professionalId === candidate.professionalId) {
      professionalConflict = true;
      conflictingIds.push(appt.id);
    }
    if (appt.patientId === candidate.patientId) {
      patientConflict = true;
      if (!conflictingIds.includes(appt.id)) conflictingIds.push(appt.id);
    }
    if (
      candidate.roomId &&
      appt.roomId &&
      appt.roomId === candidate.roomId
    ) {
      roomConflict = true;
      if (!conflictingIds.includes(appt.id)) conflictingIds.push(appt.id);
    }
  }

  const hasConflict =
    professionalConflict || patientConflict || roomConflict;

  if (candidate.isSqueeze && hasConflict) {
    // Encaixe allows professional overlap only with explicit flag — still blocks patient/room
    return {
      hasConflict: patientConflict || roomConflict,
      professionalConflict: false,
      patientConflict,
      roomConflict,
      conflictingIds,
    };
  }

  return {
    hasConflict,
    professionalConflict,
    patientConflict,
    roomConflict,
    conflictingIds,
  };
}
