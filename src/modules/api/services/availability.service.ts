import type { TenantClient } from "@/lib/db/tenant-client";
import { isOccupyingStatus } from "@/modules/scheduling/services/conflict.service";
import { generateAvailableSlots } from "@/modules/scheduling/services/slot.service";

export async function getAvailabilityRange(
  db: TenantClient,
  input: {
    professionalId: string;
    serviceId: string;
    from: Date;
    to: Date;
  },
) {
  const [templates, service] = await Promise.all([
    db.scheduleTemplate.findMany({
      where: { professionalId: input.professionalId },
    }),
    db.service.findFirstOrThrow({ where: { id: input.serviceId } }),
  ]);

  const holidays = await db.holiday.findMany();
  const holidayDates = holidays.map((h) => h.date);

  const slots: { startsAt: Date; endsAt: Date; roomId: string | null }[] = [];
  const cursor = new Date(input.from);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(input.to);
  endDay.setHours(23, 59, 59, 999);

  while (cursor <= endDay) {
    const dayStart = new Date(cursor);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);

    const [exceptions, occupied] = await Promise.all([
      db.scheduleException.findMany({
        where: {
          professionalId: input.professionalId,
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
      }),
      db.appointment.findMany({
        where: {
          professionalId: input.professionalId,
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
        select: { startsAt: true, endsAt: true, status: true },
      }),
    ]);

    const daySlots = generateAvailableSlots({
      date: dayStart,
      templates,
      durationMinutes: service.durationMinutes,
      exceptions: exceptions.map((e) => ({ startsAt: e.startAt, endsAt: e.endAt })),
      holidays: holidayDates,
      occupied: occupied
        .filter((a) => isOccupyingStatus(a.status))
        .map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
    });

    for (const s of daySlots) {
      if (s.startsAt >= input.from && s.startsAt <= input.to) {
        slots.push({ startsAt: s.startsAt, endsAt: s.endsAt, roomId: s.roomId ?? null });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
