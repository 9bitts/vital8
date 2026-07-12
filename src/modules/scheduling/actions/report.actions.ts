"use server";

import { requireAuth } from "@/lib/auth/guards";
import { isOccupyingStatus } from "@/modules/scheduling/services/conflict.service";
import { generateDaySlots } from "@/modules/scheduling/services/slot.service";

function getWeekdayName(date: Date): number {
  return date.getDay();
}

const WEEKDAY_MAP = [
  "DOMINGO",
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
] as const;

export async function getOccupationReportAction(input: {
  start: Date;
  end: Date;
  professionalId?: string;
}) {
  const ctx = await requireAuth();

  const professionals = await ctx.db.professional.findMany({
    where: input.professionalId ? { id: input.professionalId } : { isActive: true },
  });

  const results = [];

  for (const prof of professionals) {
    const templates = await ctx.db.scheduleTemplate.findMany({
      where: { professionalId: prof.id },
    });

    let totalSlots = 0;
    let occupiedSlots = 0;

    const cursor = new Date(input.start);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(input.end);

    while (cursor <= end) {
      const dayTemplates = templates.filter(
        (t) => t.weekday === WEEKDAY_MAP[getWeekdayName(cursor)],
      );

      if (dayTemplates.length > 0) {
        const holidays = await ctx.db.holiday.findMany({
          where: { date: cursor },
        });
        if (holidays.length === 0) {
          const dayStart = new Date(cursor);
          const dayEnd = new Date(cursor);
          dayEnd.setHours(23, 59, 59, 999);

          const appointments = await ctx.db.appointment.findMany({
            where: {
              professionalId: prof.id,
              startsAt: { gte: dayStart, lte: dayEnd },
            },
          });

          for (const tmpl of dayTemplates) {
            const slots = generateDaySlots(cursor, [tmpl], 30);
            totalSlots += slots.length;
            for (const slot of slots) {
              const occupied = appointments.some(
                (a) =>
                  isOccupyingStatus(a.status) &&
                  a.startsAt < slot.endsAt &&
                  a.endsAt > slot.startsAt,
              );
              if (occupied) occupiedSlots++;
            }
          }
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    results.push({
      professionalId: prof.id,
      professionalName: prof.displayName,
      totalSlots,
      occupiedSlots,
      availableSlots: totalSlots - occupiedSlots,
      occupationRate:
        totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0,
    });
  }

  return results;
}

export async function getNoShowReportAction(input: { start: Date; end: Date }) {
  const ctx = await requireAuth();

  const appointments = await ctx.db.appointment.findMany({
    where: {
      startsAt: { gte: input.start, lte: input.end },
      status: { in: ["FALTOU", "FINALIZADO", "CANCELADO"] },
    },
    include: {
      professional: { select: { id: true, displayName: true } },
    },
  });

  const byProfessional = new Map<
    string,
    { name: string; total: number; noShows: number }
  >();

  const byWeekday = new Map<number, { total: number; noShows: number }>();

  for (const appt of appointments) {
    const profId = appt.professionalId;
    const prof = byProfessional.get(profId) ?? {
      name: appt.professional.displayName,
      total: 0,
      noShows: 0,
    };
    prof.total++;
    if (appt.status === "FALTOU") prof.noShows++;
    byProfessional.set(profId, prof);

    const wd = appt.startsAt.getDay();
    const wdStat = byWeekday.get(wd) ?? { total: 0, noShows: 0 };
    wdStat.total++;
    if (appt.status === "FALTOU") wdStat.noShows++;
    byWeekday.set(wd, wdStat);
  }

  const weekdayLabels = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];

  return {
    byProfessional: Array.from(byProfessional.entries()).map(([id, v]) => ({
      professionalId: id,
      professionalName: v.name,
      total: v.total,
      noShows: v.noShows,
      rate: v.total > 0 ? Math.round((v.noShows / v.total) * 100) : 0,
    })),
    byWeekday: Array.from(byWeekday.entries()).map(([wd, v]) => ({
      weekday: weekdayLabels[wd],
      total: v.total,
      noShows: v.noShows,
      rate: v.total > 0 ? Math.round((v.noShows / v.total) * 100) : 0,
    })),
  };
}

export async function getOriginReportAction(input: { start: Date; end: Date }) {
  const ctx = await requireAuth();

  const grouped = await ctx.db.appointment.groupBy({
    by: ["origin"],
    where: { startsAt: { gte: input.start, lte: input.end } },
    _count: { id: true },
  });

  const labels: Record<string, string> = {
    RECEPCAO: "Recepção",
    TELEFONE: "Telefone",
    ONLINE: "Online",
  };

  return grouped.map((g) => ({
    origin: g.origin,
    label: labels[g.origin] ?? g.origin,
    count: g._count.id,
  }));
}
