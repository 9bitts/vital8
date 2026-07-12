"use server";

import { revalidatePath } from "next/cache";
import type { AppointmentStatus, Prisma } from "@/generated/prisma/client";
import {
  AuthError,
  getRequestMeta,
  requireAuth,
  requireValidBranch,
  type ActionResult,
} from "@/lib/auth/guards";
import { createAuditLog } from "@/modules/core/services/audit.service";
import {
  canAllowSqueeze,
  canManageAgenda,
} from "@/modules/scheduling/lib/permissions";
import {
  appointmentCreateSchema,
  appointmentRescheduleSchema,
  appointmentStatusSchema,
  recurrenceCreateSchema,
} from "@/modules/scheduling/schemas/scheduling.schema";
import {
  createAppointment,
  createRecurrenceAppointments,
  rescheduleAppointment,
  transitionAppointmentStatus,
} from "@/modules/scheduling/services/appointment.service";
import { generateAvailableSlots } from "@/modules/scheduling/services/slot.service";
import { isOccupyingStatus } from "@/modules/scheduling/services/conflict.service";
import { branchFilter } from "@/modules/admin/services/branch.service";

async function auditAppointment(
  action: string,
  ctx: Awaited<ReturnType<typeof requireAuth>>,
  appointmentId: string,
  metadata?: Prisma.InputJsonValue,
) {
  const meta = await getRequestMeta();
  await createAuditLog({
    action,
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    entityType: "Appointment",
    entityId: appointmentId,
    metadata,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export async function listAppointmentsAction(input: {
  start: Date;
  end: Date;
  professionalIds?: string[];
  roomIds?: string[];
  serviceIds?: string[];
  statuses?: AppointmentStatus[];
}) {
  const ctx = await requireAuth();

  const where: Record<string, unknown> = {
    startsAt: { gte: input.start, lt: input.end },
    ...branchFilter(ctx.branchId),
  };

  if (input.professionalIds?.length) {
    where.professionalId = { in: input.professionalIds };
  }
  if (input.roomIds?.length) {
    where.roomId = { in: input.roomIds };
  }
  if (input.serviceIds?.length) {
    where.serviceId = { in: input.serviceIds };
  }
  if (input.statuses?.length) {
    where.status = { in: input.statuses };
  }

  return ctx.db.appointment.findMany({
    where,
    orderBy: { startsAt: "asc" },
    include: {
      patient: {
        select: { id: true, fullName: true, socialName: true, phoneSearch: true },
      },
      professional: { select: { id: true, displayName: true, color: true } },
      service: { select: { id: true, name: true, durationMinutes: true } },
      room: { select: { id: true, name: true } },
    },
  });
}

export async function getAvailableSlotsAction(input: {
  date: Date;
  professionalId: string;
  serviceId: string;
}) {
  const ctx = await requireAuth();

  const [templates, service, exceptions, holidays, occupied] = await Promise.all([
    ctx.db.scheduleTemplate.findMany({
      where: { professionalId: input.professionalId },
    }),
    ctx.db.service.findFirstOrThrow({ where: { id: input.serviceId } }),
    ctx.db.scheduleException.findMany({
      where: {
        professionalId: input.professionalId,
        startAt: { lt: new Date(input.date.getTime() + 86400000) },
        endAt: { gt: input.date },
      },
    }),
    ctx.db.holiday.findMany(),
    ctx.db.appointment.findMany({
      where: {
        professionalId: input.professionalId,
        startsAt: { lt: new Date(input.date.getTime() + 86400000) },
        endsAt: { gt: input.date },
      },
      select: { startsAt: true, endsAt: true, status: true },
    }),
  ]);

  return generateAvailableSlots({
    date: input.date,
    templates,
    durationMinutes: service.durationMinutes,
    exceptions: exceptions.map((e) => ({
      startsAt: e.startAt,
      endsAt: e.endAt,
    })),
    holidays: holidays.map((h) => h.date),
    occupied: occupied
      .filter((a) => isOccupyingStatus(a.status))
      .map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
  });
}

export async function createAppointmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    if (!canManageAgenda(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }

    const parsed = appointmentCreateSchema.parse(input);

    const branchId = parsed.branchId ?? ctx.branchId ?? null;
    if (branchId) await requireValidBranch(ctx, branchId);

    if (parsed.isSqueeze && !canAllowSqueeze(ctx.role)) {
      throw new AuthError("Encaixe requer permissão de administrador", "FORBIDDEN");
    }

    const appointment = await createAppointment(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      { ...parsed, branchId },
    );

    await auditAppointment("appointment.create", ctx, appointment.id, {
      isSqueeze: parsed.isSqueeze,
    });

    revalidatePath("/app/agenda");
    revalidatePath("/app/recepcao");
    return { success: true, data: { id: appointment.id } };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    if (e instanceof Error) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao agendar" };
  }
}

export async function createRecurrenceAction(
  input: unknown,
): Promise<ActionResult<{ created: number; groupId: string }>> {
  try {
    const ctx = await requireAuth();
    if (!canManageAgenda(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }

    const parsed = recurrenceCreateSchema.parse(input);

    if (parsed.isSqueeze && !canAllowSqueeze(ctx.role)) {
      throw new AuthError("Encaixe requer permissão de administrador", "FORBIDDEN");
    }

    const { created, groupId } = await createRecurrenceAppointments(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      parsed,
    );

    await auditAppointment("appointment.recurrence.create", ctx, groupId, {
      count: created.length,
    });

    revalidatePath("/app/agenda");
    return { success: true, data: { created: created.length, groupId } };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    if (e instanceof Error) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao criar recorrência" };
  }
}

export async function updateAppointmentStatusAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    if (!canManageAgenda(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }

    const parsed = appointmentStatusSchema.parse(input);

    await transitionAppointmentStatus(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      parsed.appointmentId,
      parsed.status,
      { cancelReason: parsed.cancelReason },
    );

    if (parsed.status === "FINALIZADO") {
      const { onAppointmentFinalized } = await import(
        "@/modules/tiss/actions/tiss.actions"
      );
      await onAppointmentFinalized(
        ctx.db,
        ctx.organizationId,
        parsed.appointmentId,
      );
      const { onAppointmentFinalizedInventory } = await import(
        "@/modules/inventory/actions/inventory.actions"
      );
      await onAppointmentFinalizedInventory(
        ctx.db,
        ctx.organizationId,
        ctx.userId,
        parsed.appointmentId,
      );
    }

    await auditAppointment("appointment.status", ctx, parsed.appointmentId, {
      status: parsed.status,
    });

    revalidatePath("/app/agenda");
    revalidatePath("/app/recepcao");
    return { success: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    if (e instanceof Error) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao atualizar status" };
  }
}

export async function rescheduleAppointmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    if (!canManageAgenda(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }

    const parsed = appointmentRescheduleSchema.parse(input);

    const newAppt = await rescheduleAppointment(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      parsed.appointmentId,
      parsed.startsAt,
      parsed.professionalId,
      parsed.roomId,
    );

    await auditAppointment("appointment.reschedule", ctx, newAppt.id, {
      from: parsed.appointmentId,
    });

    revalidatePath("/app/agenda");
    revalidatePath("/app/recepcao");
    return { success: true, data: { id: newAppt.id } };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    if (e instanceof Error) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao remarcar" };
  }
}

export async function getPatientAppointmentsAction(patientId: string) {
  const ctx = await requireAuth();
  const { getPatientAppointments } = await import(
    "@/modules/scheduling/services/appointment.service"
  );
  return getPatientAppointments(ctx.db, patientId);
}
