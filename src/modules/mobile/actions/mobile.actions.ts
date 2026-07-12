"use server";

import { requireAuth } from "@/lib/auth/guards";
import { adminPrisma } from "@/lib/db/admin-client";
import { canManageReception } from "@/modules/scheduling/lib/permissions";
import { parseOrgSettings } from "@/modules/scheduling/lib/labels";
import {
  calculateWaitMinutes,
} from "@/modules/scheduling/services/appointment.service";

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

export async function getMobileTodayAction() {
  const ctx = await requireAuth([
    "OWNER",
    "ADMIN",
    "PROFISSIONAL_SAUDE",
    "RECEPCAO",
  ]);

  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { id: ctx.organizationId },
    select: { settings: true, slug: true },
  });
  const settings = parseOrgSettings(org.settings);

  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  let professionalId: string | undefined;
  if (ctx.role === "PROFISSIONAL_SAUDE") {
    const prof = await ctx.db.professional.findFirst({
      where: { userId: ctx.userId, isActive: true },
      select: { id: true },
    });
    professionalId = prof?.id;
  }

  const appointments = await ctx.db.appointment.findMany({
    where: {
      startsAt: { gte: todayStart, lte: todayEnd },
      ...(professionalId ? { professionalId } : {}),
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

  return {
    queue,
    upcoming,
    noShows,
    finalized,
    waitingList: [],
    waitLimitMinutes: settings.receptionWaitLimitMinutes ?? 30,
    orgSlug: org.slug,
    canReception: canManageReception(ctx.role),
  };
}
