import type { TenantClient } from "@/lib/db/tenant-client";

export type NoShowRiskResult = {
  score: number;
  level: "baixo" | "medio" | "alto";
  factors: { label: string; impact: number }[];
};

export function computeNoShowRisk(input: {
  patientNoShowCount: number;
  patientTotalAppointments: number;
  weekday: number;
  hour: number;
  daysUntilAppointment: number;
  isFirstVisit: boolean;
}): NoShowRiskResult {
  const factors: { label: string; impact: number }[] = [];
  let score = 0;

  if (input.patientTotalAppointments > 0) {
    const rate = input.patientNoShowCount / input.patientTotalAppointments;
    const impact = Math.round(rate * 40);
    if (impact > 0) {
      score += impact;
      factors.push({ label: `Histórico de faltas (${input.patientNoShowCount}/${input.patientTotalAppointments})`, impact });
    }
  }

  if (input.weekday === 1) {
    score += 15;
    factors.push({ label: "Agendamento em segunda-feira", impact: 15 });
  }

  if (input.hour < 9) {
    score += 10;
    factors.push({ label: "Horário antes das 9h", impact: 10 });
  }

  if (input.daysUntilAppointment > 14) {
    score += 12;
    factors.push({ label: "Antecedência superior a 14 dias", impact: 12 });
  }

  if (input.isFirstVisit) {
    score += 8;
    factors.push({ label: "Primeira consulta na clínica", impact: 8 });
  }

  score = Math.min(100, score);
  const level = score >= 50 ? "alto" : score >= 25 ? "medio" : "baixo";
  return { score, level, factors };
}

export async function scoreAppointmentNoShowRisk(
  db: TenantClient,
  appointmentId: string,
): Promise<NoShowRiskResult> {
  const appt = await db.appointment.findFirstOrThrow({
    where: { id: appointmentId },
    include: { patient: true },
  });

  const history = await db.appointment.groupBy({
    by: ["status"],
    where: { patientId: appt.patientId },
    _count: true,
  });

  const total = history.reduce((s, h) => s + h._count, 0);
  const noShows = history.find((h) => h.status === "FALTOU")?._count ?? 0;
  const completed = history.find((h) => h.status === "FINALIZADO")?._count ?? 0;

  const now = new Date();
  const daysUntil = Math.ceil(
    (appt.startsAt.getTime() - now.getTime()) / (86400_000),
  );

  return computeNoShowRisk({
    patientNoShowCount: noShows,
    patientTotalAppointments: total,
    weekday: appt.startsAt.getDay(),
    hour: appt.startsAt.getHours(),
    daysUntilAppointment: Math.max(0, daysUntil),
    isFirstVisit: completed === 0,
  });
}

export async function rankTodayAppointmentsByNoShowRisk(db: TenantClient) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const appts = await db.appointment.findMany({
    where: {
      startsAt: { gte: start, lt: end },
      status: { in: ["AGENDADO", "CONFIRMADO"] },
    },
    include: { patient: { select: { id: true, fullName: true } } },
  });

  const scored = await Promise.all(
    appts.map(async (a) => ({
      appointmentId: a.id,
      patientName: a.patient.fullName,
      startsAt: a.startsAt,
      risk: await scoreAppointmentNoShowRisk(db, a.id),
    })),
  );

  return scored.sort((a, b) => b.risk.score - a.risk.score);
}

export function suggestOverbookingSlot(risks: { score: number }[]): {
  suggest: boolean;
  reason: string;
} {
  const high = risks.filter((r) => r.score >= 50);
  if (high.length >= 2) {
    return {
      suggest: true,
      reason: `${high.length} agendamentos com risco alto de no-show — considere encaixe assistido`,
    };
  }
  return { suggest: false, reason: "Risco agregado dentro da normalidade" };
}
