import { createHmac, timingSafeEqual } from "crypto";
import type { TenantClient } from "@/lib/db/tenant-client";
import { adminPrisma } from "@/lib/db/admin-client";
import {
  SNAPSHOT_WINDOW_DAYS_BACK,
  SNAPSHOT_WINDOW_DAYS_FORWARD,
  type AgendaSnapshot,
  type OfflineActionType,
} from "@/lib/offline/types";
import {
  callPatient,
  createAppointment,
  transitionAppointmentStatus,
} from "@/modules/scheduling/services/appointment.service";

export function deriveCacheKeyMaterial(userId: string, organizationId: string): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-secret";
  return createHmac("sha256", secret)
    .update(`${userId}:${organizationId}:mobile-cache`)
    .digest("base64");
}

export function verifyCacheKeyMaterial(
  userId: string,
  organizationId: string,
  material: string,
): boolean {
  const expected = deriveCacheKeyMaterial(userId, organizationId);
  try {
    return timingSafeEqual(Buffer.from(material), Buffer.from(expected));
  } catch {
    return false;
  }
}

function snapshotWindow() {
  const from = new Date();
  from.setDate(from.getDate() - SNAPSHOT_WINDOW_DAYS_BACK);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setDate(to.getDate() + SNAPSHOT_WINDOW_DAYS_FORWARD);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export async function buildAgendaSnapshot(
  db: TenantClient,
  organizationId: string,
  professionalId?: string | null,
): Promise<AgendaSnapshot> {
  const { from, to } = snapshotWindow();
  const appointments = await db.appointment.findMany({
    where: {
      startsAt: { gte: from, lte: to },
      ...(professionalId ? { professionalId } : {}),
      status: { notIn: ["CANCELADO", "REMARCADO"] },
    },
    orderBy: { startsAt: "asc" },
    include: {
      patient: {
        select: {
          id: true,
          fullName: true,
          socialName: true,
          phonesEncrypted: true,
        },
      },
      professional: { select: { id: true, displayName: true, color: true } },
      service: { select: { name: true } },
      patientInsurancePlan: { select: { insurerName: true, planName: true } },
    },
  });

  const patientIds = Array.from(new Set(appointments.map((a) => a.patientId)));
  const allergies = await db.allergy.findMany({
    where: { patientId: { in: patientIds } },
    select: { patientId: true, substance: true },
  });

  const allergyMap = new Map<string, string[]>();
  for (const a of allergies) {
    const list = allergyMap.get(a.patientId) ?? [];
    list.push(a.substance);
    allergyMap.set(a.patientId, list);
  }

  const patients = patientIds.map((id) => {
    const appt = appointments.find((a) => a.patientId === id)!;
    return {
      id,
      fullName: appt.patient.socialName ?? appt.patient.fullName,
      phone: null as string | null,
      insurerName: appt.patientInsurancePlan?.insurerName ?? null,
      allergies: allergyMap.get(id) ?? [],
    };
  });

  return {
    syncedAt: new Date().toISOString(),
    windowFrom: from.toISOString(),
    windowTo: to.toISOString(),
    appointments: appointments.map((a) => ({
      id: a.id,
      patientId: a.patientId,
      professionalId: a.professionalId,
      serviceId: a.serviceId,
      status: a.status,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      arrivedAt: a.arrivedAt?.toISOString() ?? null,
      calledAt: a.calledAt?.toISOString() ?? null,
      offlineProvisional: a.offlineProvisional,
      patientName: a.patient.socialName ?? a.patient.fullName,
      professionalName: a.professional.displayName,
      serviceName: a.service.name,
    })),
    patients,
  };
}

export async function listAppointmentDelta(
  db: TenantClient,
  updatedAfter: Date,
  professionalId?: string | null,
) {
  const { from, to } = snapshotWindow();
  return db.appointment.findMany({
    where: {
      updatedAt: { gte: updatedAfter },
      startsAt: { gte: from, lte: to },
      ...(professionalId ? { professionalId } : {}),
    },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      updatedAt: true,
      offlineProvisional: true,
    },
  });
}

async function assertVersion(
  db: TenantClient,
  appointmentId: string,
  expectedUpdatedAt?: string | null,
) {
  if (!expectedUpdatedAt) return;
  const row = await db.appointment.findFirst({ where: { id: appointmentId } });
  if (!row) throw new SyncConflictError("VERSION_MISMATCH", "Agendamento não encontrado");
  if (row.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new SyncConflictError(
      "VERSION_MISMATCH",
      "O agendamento foi alterado no servidor enquanto você estava offline",
    );
  }
}

export class SyncConflictError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SyncConflictError";
  }
}

export async function applyOfflineAction(
  db: TenantClient,
  organizationId: string,
  userId: string,
  input: {
    type: OfflineActionType;
    payload: Record<string, unknown>;
    expectedUpdatedAt?: string | null;
  },
) {
  const { type, payload, expectedUpdatedAt } = input;

  switch (type) {
    case "CONFIRM_APPOINTMENT": {
      const id = payload.appointmentId as string;
      await assertVersion(db, id, expectedUpdatedAt);
      return transitionAppointmentStatus(db, organizationId, userId, id, "CONFIRMADO");
    }
    case "MARK_NO_SHOW": {
      const id = payload.appointmentId as string;
      await assertVersion(db, id, expectedUpdatedAt);
      return transitionAppointmentStatus(db, organizationId, userId, id, "FALTOU");
    }
    case "START_APPOINTMENT": {
      const id = payload.appointmentId as string;
      await assertVersion(db, id, expectedUpdatedAt);
      return transitionAppointmentStatus(db, organizationId, userId, id, "EM_ATENDIMENTO");
    }
    case "FINISH_APPOINTMENT": {
      const id = payload.appointmentId as string;
      await assertVersion(db, id, expectedUpdatedAt);
      return transitionAppointmentStatus(db, organizationId, userId, id, "FINALIZADO");
    }
    case "CALL_PATIENT": {
      const id = payload.appointmentId as string;
      await assertVersion(db, id, expectedUpdatedAt);
      return callPatient(db, organizationId, id);
    }
    case "BLOCK_SLOT": {
      return db.scheduleException.create({
        data: {
          organizationId,
          professionalId: payload.professionalId as string,
          startAt: new Date(payload.startsAt as string),
          endAt: new Date(payload.endsAt as string),
          reason: (payload.reason as string) ?? "Bloqueio mobile",
        },
      });
    }
    case "CREATE_PROVISIONAL_APPOINTMENT": {
      try {
        const appt = await createAppointment(db, organizationId, userId, {
          patientId: payload.patientId as string,
          professionalId: payload.professionalId as string,
          serviceId: payload.serviceId as string,
          startsAt: new Date(payload.startsAt as string),
          notes: (payload.notes as string) ?? "PROVISORIO_OFFLINE",
          sendConfirmation: false,
        });
        return db.appointment.update({
          where: { id: appt.id },
          data: { offlineProvisional: true },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Conflito de horário";
        if (msg.toLowerCase().includes("conflit") || msg.toLowerCase().includes("ocupad")) {
          throw new SyncConflictError("SLOT_CONFLICT", msg);
        }
        throw err;
      }
    }
    case "PERSONAL_NOTE": {
      return { ok: true, note: payload.note };
    }
    default:
      throw new Error(`Ação offline não suportada: ${type}`);
  }
}

export async function checkMobileIdempotency(
  userId: string,
  idempotencyKey: string,
): Promise<{ statusCode: number; body: unknown } | null> {
  const row = await adminPrisma.mobileIdempotencyRecord.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
  });
  if (!row || row.expiresAt < new Date()) return null;
  return { statusCode: row.statusCode, body: row.responseBody };
}

export async function storeMobileIdempotency(input: {
  organizationId: string;
  userId: string;
  idempotencyKey: string;
  actionType: string;
  statusCode: number;
  responseBody: unknown;
}) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  await adminPrisma.mobileIdempotencyRecord.upsert({
    where: {
      userId_idempotencyKey: {
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    create: {
      organizationId: input.organizationId,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      actionType: input.actionType,
      statusCode: input.statusCode,
      responseBody: input.responseBody as object,
      expiresAt,
    },
    update: {
      statusCode: input.statusCode,
      responseBody: input.responseBody as object,
      expiresAt,
    },
  });
}

export async function logMobileSync(input: {
  organizationId: string;
  userId: string;
  durationMs: number;
  actionsApplied: number;
  actionsRejected: number;
  actionsPending: number;
  metadata?: Record<string, unknown>;
}) {
  return adminPrisma.mobileSyncLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      durationMs: input.durationMs,
      actionsApplied: input.actionsApplied,
      actionsRejected: input.actionsRejected,
      actionsPending: input.actionsPending,
      metadata: (input.metadata ?? {}) as object,
    },
  });
}
