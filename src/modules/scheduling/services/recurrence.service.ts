import type { RecurrenceFrequency } from "@/generated/prisma/client";
import type { ConflictCheckInput } from "./conflict.service";
import { detectResourceConflicts, type TaggedAppointment } from "./conflict.service";

export type RecurrenceSessionPlan = {
  index: number;
  startsAt: Date;
  endsAt: Date;
  skipped: boolean;
  conflictReason?: string;
};

export function generateRecurrenceDates(
  firstStart: Date,
  durationMinutes: number,
  count: number,
  frequency: RecurrenceFrequency,
): { startsAt: Date; endsAt: Date }[] {
  const stepDays = frequency === "WEEKLY" ? 7 : 14;
  const sessions: { startsAt: Date; endsAt: Date }[] = [];

  for (let i = 0; i < count; i++) {
    const startsAt = new Date(firstStart);
    startsAt.setDate(startsAt.getDate() + i * stepDays);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
    sessions.push({ startsAt, endsAt });
  }

  return sessions;
}

export type RecurrenceConflictStrategy = "skip" | "squeeze" | "fail";

export function planRecurrenceSessions(input: {
  firstStart: Date;
  durationMinutes: number;
  count: number;
  frequency: RecurrenceFrequency;
  professionalId: string;
  patientId: string;
  roomId?: string | null;
  existing: TaggedAppointment[];
  strategy: RecurrenceConflictStrategy;
  isSqueeze?: boolean;
}): RecurrenceSessionPlan[] {
  const dates = generateRecurrenceDates(
    input.firstStart,
    input.durationMinutes,
    input.count,
    input.frequency,
  );

  const planned: RecurrenceSessionPlan[] = [];
  const simulatedExisting = [...input.existing];

  for (let i = 0; i < dates.length; i++) {
    const { startsAt, endsAt } = dates[i];
    const candidate: ConflictCheckInput = {
      startsAt,
      endsAt,
      professionalId: input.professionalId,
      patientId: input.patientId,
      roomId: input.roomId,
      isSqueeze: input.isSqueeze,
    };

    const conflict = detectResourceConflicts(candidate, simulatedExisting);

    if (conflict.hasConflict) {
      if (input.strategy === "skip") {
        planned.push({
          index: i,
          startsAt,
          endsAt,
          skipped: true,
          conflictReason: "Conflito de horário",
        });
        continue;
      }
      if (input.strategy === "fail") {
        throw new Error(
          `Conflito na sessão ${i + 1}: profissional=${conflict.professionalConflict}, paciente=${conflict.patientConflict}, sala=${conflict.roomConflict}`,
        );
      }
    }

    planned.push({ index: i, startsAt, endsAt, skipped: false });
    simulatedExisting.push({
      id: `planned-${i}`,
      startsAt,
      endsAt,
      status: "AGENDADO",
      professionalId: input.professionalId,
      patientId: input.patientId,
      roomId: input.roomId,
      isSqueeze: input.isSqueeze,
    });
  }

  return planned;
}
