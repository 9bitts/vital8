import { describe, it, expect } from "vitest";
import {
  generateRecurrenceDates,
  planRecurrenceSessions,
} from "@/modules/scheduling/services/recurrence.service";

describe("recurrence", () => {
  const firstStart = new Date("2026-07-15T10:00:00");

  it("gera N sessões semanais", () => {
    const dates = generateRecurrenceDates(firstStart, 30, 4, "WEEKLY");
    expect(dates.length).toBe(4);
    expect(dates[1].startsAt.getDate()).toBe(22);
  });

  it("gera sessões quinzenais", () => {
    const dates = generateRecurrenceDates(firstStart, 30, 3, "BIWEEKLY");
    expect(dates[1].startsAt.getDate()).toBe(29);
  });

  it("pula sessões conflitantes com estratégia skip", () => {
    const plan = planRecurrenceSessions({
      firstStart,
      durationMinutes: 30,
      count: 3,
      frequency: "WEEKLY",
      professionalId: "prof-1",
      patientId: "pat-1",
      existing: [
        {
          id: "existing",
          startsAt: new Date("2026-07-22T10:00:00"),
          endsAt: new Date("2026-07-22T10:30:00"),
          status: "AGENDADO",
          professionalId: "prof-1",
          patientId: "pat-2",
        },
      ],
      strategy: "skip",
    });

    expect(plan[0].skipped).toBe(false);
    expect(plan[1].skipped).toBe(true);
    expect(plan[2].skipped).toBe(false);
  });

  it("falha com estratégia fail em conflito", () => {
    expect(() =>
      planRecurrenceSessions({
        firstStart,
        durationMinutes: 30,
        count: 2,
        frequency: "WEEKLY",
        professionalId: "prof-1",
        patientId: "pat-1",
        existing: [
          {
            id: "existing",
            startsAt: firstStart,
            endsAt: new Date("2026-07-15T10:30:00"),
            status: "AGENDADO",
            professionalId: "prof-1",
            patientId: "pat-2",
          },
        ],
        strategy: "fail",
      }),
    ).toThrow(/Conflito/);
  });
});
