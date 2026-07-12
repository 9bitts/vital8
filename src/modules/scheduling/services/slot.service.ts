import type { Weekday } from "@/generated/prisma/client";
import { appointmentsOverlap, type TimeRange } from "./conflict.service";

export type ScheduleTemplateRow = {
  weekday: Weekday;
  startTime: string;
  endTime: string;
  slotIntervalMinutes: number;
  defaultRoomId?: string | null;
};

export type GeneratedSlot = {
  startsAt: Date;
  endsAt: Date;
  roomId?: string | null;
};

const WEEKDAY_TO_JS: Record<Weekday, number> = {
  DOMINGO: 0,
  SEGUNDA: 1,
  TERCA: 2,
  QUARTA: 3,
  QUINTA: 4,
  SEXTA: 5,
  SABADO: 6,
};

export function parseTimeOnDate(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function weekdayFromDate(date: Date): Weekday {
  const map: Weekday[] = [
    "DOMINGO",
    "SEGUNDA",
    "TERCA",
    "QUARTA",
    "QUINTA",
    "SEXTA",
    "SABADO",
  ];
  return map[date.getDay()];
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function generateDaySlots(
  date: Date,
  templates: ScheduleTemplateRow[],
  durationMinutes: number,
): GeneratedSlot[] {
  const dayWeekday = weekdayFromDate(date);
  const dayTemplates = templates.filter((t) => t.weekday === dayWeekday);
  const slots: GeneratedSlot[] = [];

  for (const template of dayTemplates) {
    const windowStart = parseTimeOnDate(date, template.startTime);
    const windowEnd = parseTimeOnDate(date, template.endTime);
    let cursor = new Date(windowStart);

    while (cursor.getTime() + durationMinutes * 60_000 <= windowEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000);
      slots.push({
        startsAt: new Date(cursor),
        endsAt: slotEnd,
        roomId: template.defaultRoomId,
      });
      cursor = new Date(
        cursor.getTime() + template.slotIntervalMinutes * 60_000,
      );
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function filterSlotsByExceptions(
  slots: GeneratedSlot[],
  exceptions: TimeRange[],
): GeneratedSlot[] {
  return slots.filter(
    (slot) =>
      !exceptions.some((ex) =>
        appointmentsOverlap(slot, ex),
      ),
  );
}

export function filterSlotsByHolidays(
  slots: GeneratedSlot[],
  holidays: Date[],
): GeneratedSlot[] {
  if (holidays.length === 0) return slots;
  return slots.filter(
    (slot) =>
      !holidays.some((h) => isSameCalendarDay(slot.startsAt, h)),
  );
}

export function filterOccupiedSlots(
  slots: GeneratedSlot[],
  occupied: TimeRange[],
): GeneratedSlot[] {
  return slots.filter(
    (slot) =>
      !occupied.some((appt) => appointmentsOverlap(slot, appt)),
  );
}

export function generateAvailableSlots(input: {
  date: Date;
  templates: ScheduleTemplateRow[];
  durationMinutes: number;
  exceptions: TimeRange[];
  holidays: Date[];
  occupied: TimeRange[];
}): GeneratedSlot[] {
  const raw = generateDaySlots(
    input.date,
    input.templates,
    input.durationMinutes,
  );
  const withoutExceptions = filterSlotsByExceptions(raw, input.exceptions);
  const withoutHolidays = filterSlotsByHolidays(
    withoutExceptions,
    input.holidays,
  );
  return filterOccupiedSlots(withoutHolidays, input.occupied);
}

export function getWeekdayNumber(weekday: Weekday): number {
  return WEEKDAY_TO_JS[weekday];
}
