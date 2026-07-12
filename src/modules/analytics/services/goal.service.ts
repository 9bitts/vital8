import { adminPrisma } from "@/lib/db/admin-client";
import { linearProjection, monthRange } from "../lib/periods";

export async function listGoals(organizationId: string, year: number, month: number) {
  return adminPrisma.performanceGoal.findMany({
    where: { organizationId, year, month },
    include: { professional: { select: { displayName: true } } },
  });
}

export async function upsertGoal(input: {
  organizationId: string;
  professionalId?: string | null;
  year: number;
  month: number;
  goalType: "REVENUE" | "APPOINTMENTS" | "NEW_PATIENTS" | "NPS";
  targetValue: number;
}) {
  const existing = await adminPrisma.performanceGoal.findFirst({
    where: {
      organizationId: input.organizationId,
      professionalId: input.professionalId ?? null,
      year: input.year,
      month: input.month,
      goalType: input.goalType,
    },
  });
  if (existing) {
    return adminPrisma.performanceGoal.update({
      where: { id: existing.id },
      data: { targetValue: input.targetValue },
    });
  }
  return adminPrisma.performanceGoal.create({
    data: {
      organizationId: input.organizationId,
      professionalId: input.professionalId ?? null,
      year: input.year,
      month: input.month,
      goalType: input.goalType,
      targetValue: input.targetValue,
    },
  });
}

export async function getGoalProgress(
  organizationId: string,
  goalId: string,
) {
  const goal = await adminPrisma.performanceGoal.findFirstOrThrow({
    where: { id: goalId, organizationId },
  });
  const range = monthRange(goal.year, goal.month);
  const rows = await adminPrisma.dailyOrgMetrics.findMany({
    where: {
      organizationId,
      date: { gte: range.from, lte: range.to },
    },
  });

  let current = 0;
  switch (goal.goalType) {
    case "REVENUE":
      current = rows.reduce((s, r) => s + r.revenueReceivedCents, 0);
      break;
    case "APPOINTMENTS":
      current = rows.reduce((s, r) => s + r.appointmentsCompleted, 0);
      break;
    case "NEW_PATIENTS":
      current = rows.reduce((s, r) => s + r.newPatients, 0);
      break;
    case "NPS":
      current =
        rows.reduce((s, r) => s + r.npsCount, 0) > 0
          ? Math.round(
              rows.reduce((s, r) => s + (r.npsAvg ?? 0) * r.npsCount, 0) /
                rows.reduce((s, r) => s + r.npsCount, 0),
            )
          : 0;
      break;
  }

  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(goal.year, goal.month, 0).getDate();
  const projection = linearProjection(current, dayOfMonth, daysInMonth);
  const pct = goal.targetValue ? Math.round((current / goal.targetValue) * 100) : 0;

  return { goal, current, projection, progressPct: pct };
}
