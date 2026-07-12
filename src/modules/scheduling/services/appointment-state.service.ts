import type { AppointmentStatus } from "@/generated/prisma/client";

export const PRE_ATTENDANCE_STATUSES: AppointmentStatus[] = [
  "AGENDADO",
  "CONFIRMADO",
  "AGUARDANDO",
];

export const TERMINAL_STATUSES: AppointmentStatus[] = [
  "FINALIZADO",
  "FALTOU",
  "CANCELADO",
  "REMARCADO",
];

const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  AGENDADO: ["CONFIRMADO", "AGUARDANDO", "FALTOU", "CANCELADO", "REMARCADO"],
  CONFIRMADO: ["AGUARDANDO", "FALTOU", "CANCELADO", "REMARCADO"],
  AGUARDANDO: ["EM_ATENDIMENTO", "FALTOU", "CANCELADO", "REMARCADO"],
  EM_ATENDIMENTO: ["FINALIZADO", "CANCELADO"],
  FINALIZADO: [],
  FALTOU: [],
  CANCELADO: [],
  REMARCADO: [],
};

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isPreAttendance(status: AppointmentStatus): boolean {
  return PRE_ATTENDANCE_STATUSES.includes(status);
}

export function assertTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Transição inválida: ${from} → ${to}`);
  }
}

export function statusRequiresArrival(status: AppointmentStatus): boolean {
  return status === "AGUARDANDO" || status === "EM_ATENDIMENTO";
}
