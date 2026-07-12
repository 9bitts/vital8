import { z } from "zod";
import {
  createAppointment,
  rescheduleAppointment,
  transitionAppointmentStatus,
} from "@/modules/scheduling/services/appointment.service";
import { apiSuccess, decodeCursor, encodeCursor, parseLimit } from "../lib/response";
import { conflict, notFound, validationError } from "../lib/errors";
import { toAppointmentDto, toSlotDto } from "../serializers/dtos";
import { auditApiWrite } from "../lib/router";
import type { ApiContext } from "../middleware/authenticate";
import { emitWebhookEvent } from "../services/webhook.service";
import { getAvailabilityRange } from "../services/availability.service";

const createApptSchema = z.object({
  patientId: z.string(),
  professionalId: z.string(),
  serviceId: z.string(),
  roomId: z.string().optional(),
  branchId: z.string().optional(),
  startsAt: z.string().datetime(),
  notes: z.string().optional(),
});

export async function listAvailability(req: Request, ctx: ApiContext) {
  const url = new URL(req.url);
  const professionalId = url.searchParams.get("professionalId");
  const serviceId = url.searchParams.get("serviceId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!professionalId || !serviceId || !from || !to) {
    throw validationError("professionalId, serviceId, from e to são obrigatórios");
  }

  const slots = await getAvailabilityRange(ctx.db, {
    professionalId,
    serviceId,
    from: new Date(from),
    to: new Date(to),
  });

  return apiSuccess(slots.map(toSlotDto));
}

export async function listAppointments(req: Request, ctx: ApiContext) {
  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursorRaw = url.searchParams.get("cursor");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.startsAt = {};
    if (from) (where.startsAt as Record<string, Date>).gte = new Date(from);
    if (to) (where.startsAt as Record<string, Date>).lte = new Date(to);
  }
  if (cursorRaw) {
    const c = decodeCursor(cursorRaw);
    if (c) where.id = { gt: c.id };
  }

  const rows = await ctx.db.appointment.findMany({
    where,
    orderBy: { startsAt: "asc" },
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return apiSuccess(page.map(toAppointmentDto), {
    limit,
    hasMore,
    cursor: hasMore && last ? encodeCursor(last.id, last.updatedAt) : null,
  });
}

export async function getAppointment(ctx: ApiContext, id: string) {
  const a = await ctx.db.appointment.findFirst({ where: { id } });
  if (!a) throw notFound("Agendamento");
  return apiSuccess(toAppointmentDto(a));
}

export async function createAppointmentHandler(req: Request, ctx: ApiContext) {
  const body = createApptSchema.safeParse(await req.json());
  if (!body.success) throw validationError("Payload inválido", body.error.issues);

  try {
    const appt = await createAppointment(ctx.db, ctx.organizationId, `api:${ctx.clientName}`, {
      patientId: body.data.patientId,
      professionalId: body.data.professionalId,
      serviceId: body.data.serviceId,
      roomId: body.data.roomId,
      startsAt: new Date(body.data.startsAt),
      origin: "API",
      notes: body.data.notes ?? `[API:${ctx.clientName}]`,
      sendConfirmation: false,
    });

    if (body.data.branchId) {
      await ctx.db.appointment.update({
        where: { id: appt.id },
        data: { branchId: body.data.branchId },
      });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await auditApiWrite(ctx, "appointment.create.api", "Appointment", appt.id, ip);
    await emitWebhookEvent(ctx.organizationId, "appointment.created", {
      id: appt.id,
      event: "appointment.created",
      occurredAt: new Date().toISOString(),
    });

    const fresh = await ctx.db.appointment.findFirstOrThrow({ where: { id: appt.id } });
    return apiSuccess(toAppointmentDto(fresh), undefined, 201);
  } catch (e) {
    throw conflict(e instanceof Error ? e.message : "Conflito de agenda");
  }
}

export async function cancelAppointment(ctx: ApiContext, id: string, req: Request) {
  const body = z.object({ reason: z.string().min(1) }).safeParse(await req.json());
  if (!body.success) throw validationError("Motivo obrigatório");

  try {
    const updated = await transitionAppointmentStatus(
      ctx.db,
      ctx.organizationId,
      `api:${ctx.clientName}`,
      id,
      "CANCELADO",
      { cancelReason: body.data.reason },
    );
    await emitWebhookEvent(ctx.organizationId, "appointment.cancelled", {
      id,
      event: "appointment.cancelled",
      occurredAt: new Date().toISOString(),
    });
    return apiSuccess(toAppointmentDto(updated));
  } catch {
    throw conflict("Transição de status inválida");
  }
}

export async function rescheduleAppointmentHandler(
  ctx: ApiContext,
  id: string,
  req: Request,
) {
  const body = z
    .object({ startsAt: z.string().datetime(), professionalId: z.string().optional() })
    .safeParse(await req.json());
  if (!body.success) throw validationError("Payload inválido");

  try {
    const updated = await rescheduleAppointment(
      ctx.db,
      ctx.organizationId,
      `api:${ctx.clientName}`,
      id,
      new Date(body.data.startsAt),
      body.data.professionalId,
    );
    await emitWebhookEvent(ctx.organizationId, "appointment.updated", {
      id,
      event: "appointment.updated",
      occurredAt: new Date().toISOString(),
    });
    return apiSuccess(toAppointmentDto(updated));
  } catch {
    throw conflict("Não foi possível remarcar");
  }
}

export async function confirmAppointment(ctx: ApiContext, id: string) {
  try {
    const updated = await transitionAppointmentStatus(
      ctx.db,
      ctx.organizationId,
      `api:${ctx.clientName}`,
      id,
      "CONFIRMADO",
    );
    await emitWebhookEvent(ctx.organizationId, "appointment.status_changed", {
      id,
      status: "CONFIRMADO",
      event: "appointment.status_changed",
      occurredAt: new Date().toISOString(),
    });
    return apiSuccess(toAppointmentDto(updated));
  } catch {
    throw conflict("Transição inválida");
  }
}
