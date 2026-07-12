"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import {
  AuthError,
  getRequestMeta,
  requireAuth,
  type ActionResult,
} from "@/lib/auth/guards";
import { adminPrisma } from "@/lib/db/admin-client";
import { createAuditLog } from "@/modules/core/services/audit.service";
import {
  canConfigureScheduling,
  canManageAgenda,
} from "@/modules/scheduling/lib/permissions";
import {
  BRAZIL_NATIONAL_HOLIDAYS_2026,
  parseOrgSettings,
} from "@/modules/scheduling/lib/labels";
import {
  holidaySchema,
  professionalSchema,
  roomSchema,
  scheduleExceptionSchema,
  scheduleTemplateSchema,
  schedulingSettingsSchema,
  serviceSchema,
} from "@/modules/scheduling/schemas/scheduling.schema";

async function auditScheduling(
  action: string,
  ctx: Awaited<ReturnType<typeof requireAuth>>,
  entityId?: string,
  metadata?: Prisma.InputJsonValue,
) {
  const meta = await getRequestMeta();
  await createAuditLog({
    action,
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    entityType: "Scheduling",
    entityId,
    metadata,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export async function listProfessionalsAction() {
  const ctx = await requireAuth();
  return ctx.db.professional.findMany({
    orderBy: { displayName: "asc" },
  });
}

export async function saveProfessionalAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    if (!canConfigureScheduling(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }
    const parsed = professionalSchema.parse(input);

    const data = {
      displayName: parsed.displayName,
      userId: parsed.userId ?? null,
      councilType: parsed.councilType ?? null,
      councilNumber: parsed.councilNumber ?? null,
      councilState: parsed.councilState ?? null,
      specialties: parsed.specialties,
      color: parsed.color,
      isActive: parsed.isActive,
    };

    const record = parsed.id
      ? await ctx.db.professional.update({
          where: { id: parsed.id },
          data,
        })
      : await ctx.db.professional.create({
          data: { organizationId: ctx.organizationId, ...data },
        });

    await auditScheduling(
      parsed.id ? "scheduling.professional.update" : "scheduling.professional.create",
      ctx,
      record.id,
    );
    revalidatePath("/app/configuracoes/agenda");
    return { success: true, data: { id: record.id } };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao salvar profissional" };
  }
}

export async function listServicesAction() {
  const ctx = await requireAuth();
  return ctx.db.service.findMany({ orderBy: { name: "asc" } });
}

export async function saveServiceAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    if (!canConfigureScheduling(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }
    const parsed = serviceSchema.parse(input);

    const data = {
      name: parsed.name,
      category: parsed.category ?? null,
      durationMinutes: parsed.durationMinutes,
      privatePrice: parsed.privatePrice,
      tussCode: parsed.tussCode ?? null,
      preparationInstructions: parsed.preparationInstructions ?? null,
      allowOnlineBooking: parsed.allowOnlineBooking,
      isActive: parsed.isActive,
    };

    const record = parsed.id
      ? await ctx.db.service.update({ where: { id: parsed.id }, data })
      : await ctx.db.service.create({
          data: { organizationId: ctx.organizationId, ...data },
        });

    await auditScheduling(
      parsed.id ? "scheduling.service.update" : "scheduling.service.create",
      ctx,
      record.id,
    );
    revalidatePath("/app/configuracoes/agenda");
    return { success: true, data: { id: record.id } };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao salvar serviço" };
  }
}

export async function listRoomsAction() {
  const ctx = await requireAuth();
  return ctx.db.room.findMany({ orderBy: { name: "asc" } });
}

export async function saveRoomAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    if (!canConfigureScheduling(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }
    const parsed = roomSchema.parse(input);

    const record = parsed.id
      ? await ctx.db.room.update({
          where: { id: parsed.id },
          data: { name: parsed.name, isActive: parsed.isActive },
        })
      : await ctx.db.room.create({
          data: {
            organizationId: ctx.organizationId,
            name: parsed.name,
            isActive: parsed.isActive,
          },
        });

    revalidatePath("/app/configuracoes/agenda");
    return { success: true, data: { id: record.id } };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao salvar sala" };
  }
}

export async function listScheduleTemplatesAction(professionalId: string) {
  const ctx = await requireAuth();
  return ctx.db.scheduleTemplate.findMany({
    where: { professionalId },
    include: { defaultRoom: true },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
}

export async function saveScheduleTemplateAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    if (!canConfigureScheduling(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }
    const parsed = scheduleTemplateSchema.parse(input);

    const data = {
      professionalId: parsed.professionalId,
      weekday: parsed.weekday,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      slotIntervalMinutes: parsed.slotIntervalMinutes,
      defaultRoomId: parsed.defaultRoomId ?? null,
    };

    const record = parsed.id
      ? await ctx.db.scheduleTemplate.update({
          where: { id: parsed.id },
          data,
        })
      : await ctx.db.scheduleTemplate.create({
          data: { organizationId: ctx.organizationId, ...data },
        });

    revalidatePath("/app/configuracoes/agenda");
    return { success: true, data: { id: record.id } };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao salvar grade" };
  }
}

export async function deleteScheduleTemplateAction(
  id: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    if (!canConfigureScheduling(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }
    await ctx.db.scheduleTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/app/configuracoes/agenda");
    return { success: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao remover grade" };
  }
}

export async function createScheduleExceptionAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    if (!canManageAgenda(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }
    const parsed = scheduleExceptionSchema.parse(input);
    await ctx.db.scheduleException.create({
      data: { organizationId: ctx.organizationId, ...parsed },
    });
    revalidatePath("/app/agenda");
    return { success: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao criar bloqueio" };
  }
}

export async function listHolidaysAction() {
  const ctx = await requireAuth();
  return ctx.db.holiday.findMany({ orderBy: { date: "asc" } });
}

export async function saveHolidayAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth();
    if (!canConfigureScheduling(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }
    const parsed = holidaySchema.parse(input);
    const record = await ctx.db.holiday.create({
      data: {
        organizationId: ctx.organizationId,
        date: parsed.date,
        name: parsed.name,
      },
    });
    revalidatePath("/app/configuracoes/agenda");
    return { success: true, data: { id: record.id } };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao salvar feriado" };
  }
}

export async function importNationalHolidaysAction(
  year: number,
): Promise<ActionResult<{ imported: number }>> {
  try {
    const ctx = await requireAuth();
    if (!canConfigureScheduling(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }

    const source =
      year === 2026
        ? BRAZIL_NATIONAL_HOLIDAYS_2026
        : BRAZIL_NATIONAL_HOLIDAYS_2026.map((h) => ({
            ...h,
            date: h.date.replace("2026", String(year)),
          }));

    let imported = 0;
    for (const h of source) {
      try {
        await ctx.db.holiday.create({
          data: {
            organizationId: ctx.organizationId,
            date: new Date(h.date),
            name: h.name,
          },
        });
        imported++;
      } catch {
        // duplicate skip
      }
    }

    revalidatePath("/app/configuracoes/agenda");
    return { success: true, data: { imported } };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao importar feriados" };
  }
}

export async function getSchedulingSettingsAction() {
  const ctx = await requireAuth();
  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: ctx.organizationId },
    select: { settings: true },
  });
  return parseOrgSettings(org.settings);
}

export async function saveSchedulingSettingsAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth();
    if (!canConfigureScheduling(ctx.role)) {
      throw new AuthError("Permissão insuficiente", "FORBIDDEN");
    }
    const parsed = schedulingSettingsSchema.parse(input);
    const org = await adminPrisma.organization.findFirstOrThrow({
      where: { id: ctx.organizationId },
      select: { settings: true },
    });
    const current =
      org.settings && typeof org.settings === "object"
        ? (org.settings as Record<string, unknown>)
        : {};

    await adminPrisma.organization.update({
      where: { id: ctx.organizationId },
      data: {
        settings: {
          ...current,
          receptionWaitLimitMinutes: parsed.receptionWaitLimitMinutes,
          professionalCanViewOthers: parsed.professionalCanViewOthers,
        },
      },
    });

    revalidatePath("/app/recepcao");
    revalidatePath("/app/configuracoes/agenda");
    return { success: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Erro ao salvar configurações" };
  }
}

export async function listOrgMembersForLinkAction() {
  const ctx = await requireAuth();
  if (!canConfigureScheduling(ctx.role)) {
    return [];
  }
  return adminPrisma.membership.findMany({
    where: { organizationId: ctx.organizationId, deletedAt: null },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}
