"use server";

import { revalidatePath } from "next/cache";
import {
  AuthError,
  requireAuth,
  type ActionResult,
} from "@/lib/auth/guards";
import { adminPrisma } from "@/lib/db/admin-client";
import {
  canCallPatient,
  canManageReception,
} from "@/modules/scheduling/lib/permissions";
import { parseOrgSettings } from "@/modules/scheduling/lib/labels";
import { waitingListSchema } from "@/modules/scheduling/schemas/scheduling.schema";
import {
  calculateWaitMinutes,
  callPatient,
  transitionAppointmentStatus,
} from "@/modules/scheduling/services/appointment.service";
import { formatPanelName } from "@/modules/scheduling/lib/labels";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function getReceptionQueueAction() {
  const ctx = await requireAuth();
  if (!canManageReception(ctx.role)) {
    throw new AuthError("Permissão insuficiente", "FORBIDDEN");
  }

  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: ctx.organizationId },
    select: { settings: true, slug: true },
  });
  const settings = parseOrgSettings(org.settings);

  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const appointments = await ctx.db.appointment.findMany({
    where: {
      startsAt: { gte: todayStart, lte: todayEnd },
      status: {
        in: [
          "AGENDADO",
          "CONFIRMADO",
          "AGUARDANDO",
          "EM_ATENDIMENTO",
          "FINALIZADO",
          "FALTOU",
        ],
      },
    },
    orderBy: [{ status: "asc" }, { arrivedAt: "asc" }, { startsAt: "asc" }],
    include: {
      patient: {
        select: { id: true, fullName: true, socialName: true },
      },
      professional: { select: { displayName: true, color: true } },
      service: { select: { name: true } },
      room: { select: { name: true } },
      sale: { select: { id: true, status: true } },
    },
  });

  const queue = appointments
    .filter((a) => a.status === "AGUARDANDO" || a.status === "EM_ATENDIMENTO")
    .map((a) => ({
      ...a,
      waitMinutes: calculateWaitMinutes(a.arrivedAt, a.startedAt),
    }));

  const upcoming = appointments.filter((a) =>
    ["AGENDADO", "CONFIRMADO"].includes(a.status),
  );

  const noShows = appointments.filter((a) => a.status === "FALTOU");

  const finalized = appointments.filter((a) => a.status === "FINALIZADO");

  const waitingList = await ctx.db.waitingListEntry.findMany({
    where: { isActive: true },
    include: {
      patient: { select: { fullName: true, socialName: true } },
      service: { select: { name: true } },
      preferredProfessional: { select: { displayName: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return {
    queue,
    upcoming,
    noShows,
    finalized,
    waitingList,
    waitLimitMinutes: settings.receptionWaitLimitMinutes ?? 30,
    orgSlug: org.slug,
  };
}

export async function checkInAction(
  appointmentId: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    if (!canManageReception(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }

    await transitionAppointmentStatus(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      appointmentId,
      "AGUARDANDO",
    );

    revalidatePath("/app/recepcao");
    return { success: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    if (e instanceof Error) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro no check-in" };
  }
}

export async function callPatientAction(
  appointmentId: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    if (!canCallPatient(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }

    await callPatient(ctx.db, ctx.organizationId, appointmentId);
    revalidatePath("/app/recepcao");
    return { success: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao chamar paciente" };
  }
}

export async function addWaitingListEntryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    if (!canManageReception(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }

    const parsed = waitingListSchema.parse(input);
    const entry = await ctx.db.waitingListEntry.create({
      data: { organizationId: ctx.organizationId, ...parsed },
    });
    revalidatePath("/app/recepcao");
    return { success: true, data: { id: entry.id } };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao adicionar à lista de espera" };
  }
}

export async function suggestWaitingListForSlotAction(input: {
  serviceId: string;
  professionalId?: string;
  startsAt: Date;
}) {
  const ctx = await requireAuth();
  if (!canManageReception(ctx.role)) {
    return [];
  }

  const entries = await ctx.db.waitingListEntry.findMany({
    where: {
      isActive: true,
      serviceId: input.serviceId,
      OR: [
        { preferredProfessionalId: null },
        { preferredProfessionalId: input.professionalId ?? undefined },
      ],
    },
    include: {
      patient: { select: { fullName: true, socialName: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 5,
  });

  return entries.filter((e) => {
    if (!e.preferredPeriodStart && !e.preferredPeriodEnd) return true;
    const start = e.preferredPeriodStart?.getTime() ?? 0;
    const end = e.preferredPeriodEnd?.getTime() ?? Infinity;
    const t = input.startsAt.getTime();
    return t >= start && t <= end;
  });
}

export async function getPanelDataAction(orgSlug: string) {
  const org = await adminPrisma.organization.findFirst({
    where: { slug: orgSlug, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });

  if (!org) return null;

  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const called = await adminPrisma.appointment.findMany({
    where: {
      organizationId: org.id,
      calledAt: { not: null },
      startsAt: { gte: todayStart, lte: todayEnd },
      deletedAt: null,
    },
    orderBy: { calledAt: "desc" },
    take: 6,
    include: {
      patient: { select: { fullName: true, socialName: true } },
      room: { select: { name: true } },
    },
  });

  return {
    orgName: org.name,
    calls: called.map((c) => ({
      id: c.id,
      name: formatPanelName(c.patient.fullName, c.patient.socialName),
      room: c.room?.name ?? "Recepção",
      queueNumber: c.queueNumber,
      calledAt: c.calledAt,
    })),
  };
}

export async function markNoShowAction(
  appointmentId: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    if (!canManageReception(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }

    await transitionAppointmentStatus(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      appointmentId,
      "FALTOU",
    );

    revalidatePath("/app/recepcao");
    revalidatePath("/app/agenda");
    return { success: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    if (e instanceof Error) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao marcar falta" };
  }
}

export async function cancelAppointmentAction(
  appointmentId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    if (!canManageReception(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }

    await transitionAppointmentStatus(
      ctx.db,
      ctx.organizationId,
      ctx.userId,
      appointmentId,
      "CANCELADO",
      { cancelReason: reason },
    );

    const appt = await ctx.db.appointment.findFirst({
      where: { id: appointmentId },
    });

    if (appt) {
      await suggestWaitingListForSlotAction({
        serviceId: appt.serviceId,
        professionalId: appt.professionalId,
        startsAt: appt.startsAt,
      });
      revalidatePath("/app/recepcao");
      revalidatePath("/app/agenda");
      return { success: true };
    }

    revalidatePath("/app/recepcao");
    revalidatePath("/app/agenda");
    return { success: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    if (e instanceof Error) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao cancelar" };
  }
}
