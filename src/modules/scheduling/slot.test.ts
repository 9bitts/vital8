import { describe, it, expect } from "vitest";
import {
  generateAvailableSlots,
  generateDaySlots,
  filterSlotsByHolidays,
  filterSlotsByExceptions,
} from "@/modules/scheduling/services/slot.service";

describe("slot generation", () => {
  const date = new Date("2026-07-15T00:00:00"); // quarta

  const templates = [
    {
      weekday: "QUARTA" as const,
      startTime: "08:00",
      endTime: "10:00",
      slotIntervalMinutes: 30,
      defaultRoomId: "room-1",
    },
  ];

  it("gera slots com duração do serviço", () => {
    const slots = generateDaySlots(date, templates, 30);
    expect(slots.length).toBe(4);
    expect(slots[0].startsAt.getHours()).toBe(8);
    expect(slots[0].endsAt.getTime() - slots[0].startsAt.getTime()).toBe(
      30 * 60_000,
    );
  });

  it("remove slots em feriado", () => {
    const slots = generateDaySlots(date, templates, 30);
    const filtered = filterSlotsByHolidays(slots, [date]);
    expect(filtered.length).toBe(0);
  });

  it("remove slots bloqueados por exceção", () => {
    const slots = generateDaySlots(date, templates, 30);
    const filtered = filterSlotsByExceptions(slots, [
      {
        startsAt: new Date("2026-07-15T08:00:00"),
        endsAt: new Date("2026-07-15T09:00:00"),
      },
    ]);
    expect(filtered.every((s) => s.startsAt.getHours() >= 9)).toBe(true);
  });

  it("integra templates, feriados, exceções e ocupados", () => {
    const available = generateAvailableSlots({
      date,
      templates,
      durationMinutes: 30,
      exceptions: [],
      holidays: [],
      occupied: [
        {
          startsAt: new Date("2026-07-15T08:00:00"),
          endsAt: new Date("2026-07-15T08:30:00"),
        },
      ],
    });
    expect(available.length).toBe(3);
    expect(available[0].startsAt.getHours()).toBe(8);
    expect(available[0].startsAt.getMinutes()).toBe(30);
  });
});
