import { randomBytes } from "crypto";
import type {
  AppointmentOrigin,
  AppointmentStatus,
  ConfirmationChannel,
  Prisma,
} from "@/generated/prisma/client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { adminPrisma } from "@/lib/db/admin-client";
import { getMessagingAdapter } from "@/lib/integrations/messaging";
import { decryptPHI } from "@/lib/crypto/phi";
import {
  detectResourceConflicts,
  isOccupyingStatus,
  type TaggedAppointment,
} from "./conflict.service";
import {
  assertTransition,
  isPreAttendance,
} from "./appointment-state.service";
import { planRecurrenceSessions } from "./recurrence.service";
import type { RecurrenceConflictStrategy } from "./recurrence.service";

export type CreateAppointmentInput = {
  patientId: string;
  professionalId: string;
  serviceId: string;
  roomId?: string | null;
  startsAt: Date;
  origin?: AppointmentOrigin;
  isPrivate?: boolean;
  patientInsurancePlanId?: string | null;
  notes?: string | null;
  isSqueeze?: boolean;
  recurrenceGroupId?: string | null;
  rescheduledFromId?: string | null;
  sendConfirmation?: boolean;
  confirmationChannel?: ConfirmationChannel;
};

async function loadOccupyingAppointments(
  db: TenantClient,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<TaggedAppointment[]> {
  const items = await db.appointment.findMany({
    where: {
      startsAt: { lt: rangeEnd },
      endsAt: { gt: rangeStart },
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      isSqueeze: true,
      professionalId: true,
      patientId: true,
      roomId: true,
    },
  });

  return items.filter((a) => isOccupyingStatus(a.status));
}

export async function validateAppointmentSlot(
  db: TenantClient,
  input: CreateAppointmentInput & { excludeAppointmentId?: string },
  durationMinutes: number,
): Promise<{ endsAt: Date }> {
  const endsAt = new Date(
    input.startsAt.getTime() + durationMinutes * 60_000,
  );

  const existing = await loadOccupyingAppointments(
    db,
    input.startsAt,
    endsAt,
  );

  const conflict = detectResourceConflicts(
    {
      startsAt: input.startsAt,
      endsAt,
      professionalId: input.professionalId,
      patientId: input.patientId,
      roomId: input.roomId,
      excludeAppointmentId: input.excludeAppointmentId,
      isSqueeze: input.isSqueeze,
    },
    existing,
  );

  if (conflict.hasConflict) {
    const parts: string[] = [];
    if (conflict.professionalConflict) parts.push("profissional");
    if (conflict.patientConflict) parts.push("paciente");
    if (conflict.roomConflict) parts.push("sala");
    throw new Error(`Conflito de horário: ${parts.join(", ")}`);
  }

  return { endsAt };
}

export async function recordStatusChange(
  organizationId: string,
  appointmentId: string,
  fromStatus: AppointmentStatus | null,
  toStatus: AppointmentStatus,
  changedById?: string | null,
  metadata?: Prisma.InputJsonValue,
) {
  return adminPrisma.appointmentStatusHistory.create({
    data: {
      organizationId,
      appointmentId,
      fromStatus,
      toStatus,
      changedById: changedById ?? null,
      metadata: metadata ?? {},
    },
  });
}

function generateConfirmationToken(): string {
  return randomBytes(24).toString("hex");
}

export async function sendAppointmentConfirmation(
  organizationId: string,
  appointmentId: string,
  channel: ConfirmationChannel,
  baseUrl: string,
) {
  const appointment = await adminPrisma.appointment.findFirst({
    where: { id: appointmentId, organizationId },
    include: {
      patient: { select: { fullName: true, phonesEncrypted: true } },
      professional: { select: { displayName: true } },
      service: { select: { name: true } },
    },
  });

  if (!appointment) return null;

  const token = generateConfirmationToken();
  const confirmation = await adminPrisma.appointmentConfirmation.create({
    data: {
      organizationId,
      appointmentId,
      channel,
      token,
      status: "PENDENTE",
    },
  });

  let phone = "";
  if (appointment.patient.phonesEncrypted) {
    try {
      phone = decryptPHI(appointment.patient.phonesEncrypted);
    } catch {
      phone = "";
    }
  }

  const link = `${baseUrl}/confirmar/${token}`;
  const body = `Olá! Confirme sua consulta de ${appointment.service.name} com ${appointment.professional.displayName} em ${appointment.startsAt.toLocaleString("pt-BR")}. Link: ${link}`;

  const messaging = getMessagingAdapter();
  await messaging.send({
    channel,
    to: phone || "sem-telefone@vital8.local",
    body,
    metadata: { appointmentId, token },
  });

  return confirmation;
}

export async function createAppointment(
  db: TenantClient,
  organizationId: string,
  userId: string,
  input: CreateAppointmentInput,
) {
  const service = await db.service.findFirstOrThrow({
    where: { id: input.serviceId },
  });

  const { endsAt } = await validateAppointmentSlot(
    db,
    input,
    service.durationMinutes,
  );

  const appointment = await db.appointment.create({
    data: {
      organizationId,
      patientId: input.patientId,
      professionalId: input.professionalId,
      serviceId: input.serviceId,
      roomId: input.roomId ?? null,
      startsAt: input.startsAt,
      endsAt,
      origin: input.origin ?? "RECEPCAO",
      isPrivate: input.isPrivate ?? true,
      patientInsurancePlanId: input.patientInsurancePlanId ?? null,
      expectedAmount: input.isPrivate ? service.privatePrice : null,
      notes: input.notes ?? null,
      isSqueeze: input.isSqueeze ?? false,
      recurrenceGroupId: input.recurrenceGroupId ?? null,
      rescheduledFromId: input.rescheduledFromId ?? null,
      status: "AGENDADO",
    },
  });

  await recordStatusChange(
    organizationId,
    appointment.id,
    null,
    "AGENDADO",
    userId,
    { origin: input.origin ?? "RECEPCAO", isSqueeze: input.isSqueeze ?? false },
  );

  if (input.sendConfirmation !== false) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await sendAppointmentConfirmation(
      organizationId,
      appointment.id,
      input.confirmationChannel ?? "WHATSAPP",
      baseUrl,
    );
  }

  const { scheduleAppointmentConfirmations } = await import(
    "@/modules/engagement/services/automation.service"
  );
  await scheduleAppointmentConfirmations(organizationId, appointment.id);

  return appointment;
}

export async function createRecurrenceAppointments(
  db: TenantClient,
  organizationId: string,
  userId: string,
  input: CreateAppointmentInput & {
    sessionCount: number;
    frequency: "WEEKLY" | "BIWEEKLY";
    conflictStrategy: RecurrenceConflictStrategy;
  },
) {
  const service = await db.service.findFirstOrThrow({
    where: { id: input.serviceId },
  });

  const rangeEnd = new Date(input.startsAt);
  rangeEnd.setDate(
    rangeEnd.getDate() +
      (input.sessionCount - 1) * (input.frequency === "WEEKLY" ? 7 : 14) +
      1,
  );

  const existing = await loadOccupyingAppointments(
    db,
    input.startsAt,
    rangeEnd,
  );

  const plan = planRecurrenceSessions({
    firstStart: input.startsAt,
    durationMinutes: service.durationMinutes,
    count: input.sessionCount,
    frequency: input.frequency,
    professionalId: input.professionalId,
    patientId: input.patientId,
    roomId: input.roomId,
    existing,
    strategy: input.conflictStrategy,
    isSqueeze: input.isSqueeze,
  });

  const groupId = `rec-${Date.now()}`;
  const created = [];

  for (const session of plan) {
    if (session.skipped) continue;

    const appt = await createAppointment(db, organizationId, userId, {
      ...input,
      startsAt: session.startsAt,
      recurrenceGroupId: groupId,
      sendConfirmation: false,
    });
    created.push(appt);
  }

  return { groupId, created, plan };
}

export async function transitionAppointmentStatus(
  db: TenantClient,
  organizationId: string,
  userId: string,
  appointmentId: string,
  toStatus: AppointmentStatus,
  options?: { cancelReason?: string | null },
) {
  const appointment = await db.appointment.findFirstOrThrow({
    where: { id: appointmentId },
  });

  assertTransition(appointment.status, toStatus);

  const data: Prisma.AppointmentUpdateInput = { status: toStatus };

  if (toStatus === "AGUARDANDO" && !appointment.arrivedAt) {
    data.arrivedAt = new Date();
    const maxQueue = await db.appointment.aggregate({
      where: {
        startsAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        queueNumber: { not: null },
      },
      _max: { queueNumber: true },
    });
    data.queueNumber = (maxQueue._max.queueNumber ?? 0) + 1;
  }

  if (toStatus === "EM_ATENDIMENTO" && !appointment.startedAt) {
    data.startedAt = new Date();
  }

  if (toStatus === "FINALIZADO") {
    data.finishedAt = new Date();
  }

  if (toStatus === "CANCELADO" && options?.cancelReason) {
    data.cancelReason = options.cancelReason;
  }

  const updated = await db.appointment.update({
    where: { id: appointmentId },
    data,
  });

  await recordStatusChange(
    organizationId,
    appointmentId,
    appointment.status,
    toStatus,
    userId,
    options?.cancelReason
      ? { cancelReason: options.cancelReason }
      : undefined,
  );

  return updated;
}

export async function rescheduleAppointment(
  db: TenantClient,
  organizationId: string,
  userId: string,
  appointmentId: string,
  newStart: Date,
  professionalId?: string,
  roomId?: string | null,
) {
  const original = await db.appointment.findFirstOrThrow({
    where: { id: appointmentId },
    include: { service: true },
  });

  if (!isPreAttendance(original.status)) {
    throw new Error("Somente agendamentos pré-atendimento podem ser remarcados");
  }

  await transitionAppointmentStatus(
    db,
    organizationId,
    userId,
    appointmentId,
    "REMARCADO",
  );

  return createAppointment(db, organizationId, userId, {
    patientId: original.patientId,
    professionalId: professionalId ?? original.professionalId,
    serviceId: original.serviceId,
    roomId: roomId ?? original.roomId,
    startsAt: newStart,
    origin: original.origin,
    isPrivate: original.isPrivate,
    patientInsurancePlanId: original.patientInsurancePlanId,
    notes: original.notes,
    isSqueeze: original.isSqueeze,
    rescheduledFromId: original.id,
    sendConfirmation: true,
  });
}

export async function callPatient(
  db: TenantClient,
  organizationId: string,
  appointmentId: string,
) {
  return db.appointment.update({
    where: { id: appointmentId },
    data: { calledAt: new Date() },
  });
}

export async function getPatientAppointments(
  db: TenantClient,
  patientId: string,
) {
  return db.appointment.findMany({
    where: { patientId },
    orderBy: { startsAt: "desc" },
    include: {
      professional: { select: { displayName: true, color: true } },
      service: { select: { name: true, durationMinutes: true } },
      room: { select: { name: true } },
    },
  });
}

export async function respondToConfirmation(
  token: string,
  response: "confirm" | "cancel",
) {
  const confirmation = await adminPrisma.appointmentConfirmation.findUnique({
    where: { token },
    include: { appointment: true },
  });

  if (!confirmation || confirmation.status !== "PENDENTE") {
    throw new Error("Confirmação inválida ou já respondida");
  }

  const newConfirmationStatus =
    response === "confirm" ? "CONFIRMADO" : "CANCELADO";
  const newAppointmentStatus =
    response === "confirm" ? "CONFIRMADO" : "CANCELADO";

  await adminPrisma.appointmentConfirmation.update({
    where: { id: confirmation.id },
    data: {
      status: newConfirmationStatus,
      respondedAt: new Date(),
    },
  });

  const appt = confirmation.appointment;
  if (isPreAttendance(appt.status)) {
    await adminPrisma.appointment.update({
      where: { id: appt.id },
      data: {
        status: newAppointmentStatus,
        cancelReason:
          response === "cancel" ? "Cancelado pelo paciente via link" : undefined,
      },
    });

    await recordStatusChange(
      confirmation.organizationId,
      appt.id,
      appt.status,
      newAppointmentStatus,
      null,
      { via: "public_confirmation", token },
    );
  }

  return confirmation;
}

export function calculateWaitMinutes(
  arrivedAt: Date | null | undefined,
  startedAt: Date | null | undefined,
): number | null {
  if (!arrivedAt) return null;
  const end = startedAt ?? new Date();
  return Math.max(0, Math.round((end.getTime() - arrivedAt.getTime()) / 60_000));
}
