import { describe, it, expect } from "vitest";
import {
  appointmentsOverlap,
  detectResourceConflicts,
} from "@/modules/scheduling/services/conflict.service";

describe("conflict detection", () => {
  const base = new Date("2026-07-15T10:00:00");

  it("detecta sobreposição parcial", () => {
    const a = { startsAt: base, endsAt: new Date("2026-07-15T10:30:00") };
    const b = {
      startsAt: new Date("2026-07-15T10:15:00"),
      endsAt: new Date("2026-07-15T10:45:00"),
    };
    expect(appointmentsOverlap(a, b)).toBe(true);
  });

  it("não conflita quando horários são adjacentes", () => {
    const a = { startsAt: base, endsAt: new Date("2026-07-15T10:30:00") };
    const b = {
      startsAt: new Date("2026-07-15T10:30:00"),
      endsAt: new Date("2026-07-15T11:00:00"),
    };
    expect(appointmentsOverlap(a, b)).toBe(false);
  });

  it("bloqueia conflito de profissional", () => {
    const result = detectResourceConflicts(
      {
        startsAt: base,
        endsAt: new Date("2026-07-15T10:30:00"),
        professionalId: "prof-1",
        patientId: "pat-2",
        roomId: "room-2",
      },
      [
        {
          id: "a1",
          startsAt: base,
          endsAt: new Date("2026-07-15T10:30:00"),
          status: "AGENDADO",
          professionalId: "prof-1",
          patientId: "pat-1",
          roomId: "room-1",
        },
      ],
    );
    expect(result.professionalConflict).toBe(true);
    expect(result.hasConflict).toBe(true);
  });

  it("encaixe permite sobreposição do profissional mas não do paciente", () => {
    const result = detectResourceConflicts(
      {
        startsAt: base,
        endsAt: new Date("2026-07-15T10:30:00"),
        professionalId: "prof-1",
        patientId: "pat-2",
        isSqueeze: true,
      },
      [
        {
          id: "a1",
          startsAt: base,
          endsAt: new Date("2026-07-15T10:30:00"),
          status: "AGENDADO",
          professionalId: "prof-1",
          patientId: "pat-1",
        },
      ],
    );
    expect(result.professionalConflict).toBe(false);
    expect(result.hasConflict).toBe(false);
  });

  it("encaixe ainda bloqueia paciente duplicado", () => {
    const result = detectResourceConflicts(
      {
        startsAt: base,
        endsAt: new Date("2026-07-15T10:30:00"),
        professionalId: "prof-2",
        patientId: "pat-1",
        isSqueeze: true,
      },
      [
        {
          id: "a1",
          startsAt: base,
          endsAt: new Date("2026-07-15T10:30:00"),
          status: "AGENDADO",
          professionalId: "prof-1",
          patientId: "pat-1",
        },
      ],
    );
    expect(result.patientConflict).toBe(true);
    expect(result.hasConflict).toBe(true);
  });
});
