import type { Role } from "@/generated/prisma/client";
import type { TenantClient } from "@/lib/db/tenant-client";
import { adminPrisma } from "@/lib/db/admin-client";
import {
  linearProjection,
  monthRange,
  pctChange,
  previousMonth,
  toSpDateKey,
} from "../lib/periods";

export async function getExecutiveDashboard(
  organizationId: string,
  year: number,
  month: number,
  branchId?: string | null,
) {
  if (branchId) {
    return getExecutiveDashboardByBranch(organizationId, year, month, branchId);
  }

  const current = monthRange(year, month);
  const prev = previousMonth(year, month);
  const previous = monthRange(prev.year, prev.month);

  const [curRows, prevRows, profRows, services] = await Promise.all([
    adminPrisma.dailyOrgMetrics.findMany({
      where: {
        organizationId,
        date: { gte: current.from, lte: current.to },
      },
      orderBy: { date: "asc" },
    }),
    adminPrisma.dailyOrgMetrics.findMany({
      where: {
        organizationId,
        date: { gte: previous.from, lte: previous.to },
      },
    }),
    adminPrisma.dailyProfessionalMetrics.groupBy({
      by: ["professionalId"],
      where: {
        organizationId,
        date: { gte: current.from, lte: current.to },
      },
      _sum: { appointmentsCompleted: true, slotsOccupied: true, slotsAvailable: true },
    }),
    adminPrisma.professional.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, displayName: true },
    }),
  ]);

  const sum = (rows: typeof curRows, key: keyof (typeof curRows)[0]) =>
    rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);

  const completed = sum(curRows, "appointmentsCompleted");
  const prevCompleted = sum(prevRows, "appointmentsCompleted");
  const revenue = sum(curRows, "revenueReceivedCents");
  const prevRevenue = sum(prevRows, "revenueReceivedCents");
  const noShow = sum(curRows, "appointmentsNoShow");
  const scheduled = sum(curRows, "appointmentsScheduled");
  const slotsAvail = sum(curRows, "slotsAvailable");
  const slotsOcc = sum(curRows, "slotsOccupied");

  const profMap = new Map(profRows.map((p) => [p.professionalId, p]));
  const occupationRanking = services
    .map((s) => {
      const m = profMap.get(s.id);
      const avail = m?._sum.slotsAvailable ?? 0;
      const occ = m?._sum.slotsOccupied ?? 0;
      return {
        id: s.id,
        name: s.displayName,
        completed: m?._sum.appointmentsCompleted ?? 0,
        occupationPct: avail ? Math.round((occ / avail) * 100) : 0,
      };
    })
    .sort((a, b) => b.completed - a.completed);

  const today = new Date();
  const dayOfMonth = Number(toSpDateKey(today).split("-")[2]);
  const daysInMonth = new Date(year, month, 0).getDate();

  return {
    period: current.label,
    kpis: {
      completed: {
        value: completed,
        changePct: pctChange(completed, prevCompleted),
      },
      revenue: {
        value: revenue,
        changePct: pctChange(revenue, prevRevenue),
      },
      noShowRate: {
        value: scheduled ? Math.round((noShow / scheduled) * 100) : 0,
      },
      occupation: {
        value: slotsAvail ? Math.round((slotsOcc / slotsAvail) * 100) : 0,
      },
      nps: {
        value:
          curRows.filter((r) => r.npsCount > 0).length > 0
            ? Math.round(
                curRows.reduce((s, r) => s + (r.npsAvg ?? 0) * r.npsCount, 0) /
                  curRows.reduce((s, r) => s + r.npsCount, 0),
              )
            : null,
      },
    },
    dailyRevenue: curRows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      revenue: r.revenueReceivedCents,
      appointments: r.appointmentsCompleted,
    })),
    funnel: {
      scheduled: sum(curRows, "appointmentsScheduled"),
      confirmed: sum(curRows, "appointmentsConfirmed"),
      completed,
      paid: revenue > 0 ? completed : 0,
    },
    occupationRanking,
    projection: {
      revenue: linearProjection(revenue, dayOfMonth, daysInMonth),
      appointments: linearProjection(completed, dayOfMonth, daysInMonth),
    },
  };
}

async function getExecutiveDashboardByBranch(
  organizationId: string,
  year: number,
  month: number,
  branchId: string,
) {
  const current = monthRange(year, month);
  const prev = previousMonth(year, month);
  const previous = monthRange(prev.year, prev.month);

  const tenant = (await import("@/lib/db/tenant-client")).createTenantClient(
    organizationId,
  );

  const [curAppts, prevAppts, payments] = await Promise.all([
    tenant.appointment.findMany({
      where: {
        branchId,
        startsAt: { gte: current.from, lte: current.to },
      },
    }),
    tenant.appointment.findMany({
      where: {
        branchId,
        startsAt: { gte: previous.from, lte: previous.to },
      },
    }),
    tenant.payment.findMany({
      where: {
        createdAt: { gte: current.from, lte: current.to },
        cashRegister: { branchId },
      },
    }),
  ]);

  const completed = curAppts.filter((a) => a.status === "FINALIZADO").length;
  const prevCompleted = prevAppts.filter((a) => a.status === "FINALIZADO").length;
  const scheduled = curAppts.length;
  const noShow = curAppts.filter((a) => a.status === "FALTOU").length;
  const revenue = payments.reduce((s, p) => s + p.netAmountCents, 0);

  return {
    period: current.label,
    branchId,
    kpis: {
      completed: {
        value: completed,
        changePct: pctChange(completed, prevCompleted),
      },
      revenue: { value: revenue, changePct: null },
      noShowRate: {
        value: scheduled ? Math.round((noShow / scheduled) * 100) : 0,
      },
      occupation: { value: 0 },
      nps: { value: null },
    },
    dailyRevenue: [],
    funnel: {
      scheduled,
      confirmed: curAppts.filter((a) => a.status === "CONFIRMADO").length,
      completed,
      paid: revenue > 0 ? completed : 0,
    },
    occupationRanking: [],
    projection: { revenue: revenue, appointments: completed },
  };
}

export async function getProfessionalDashboard(
  organizationId: string,
  professionalId: string,
  year: number,
  month: number,
) {
  const range = monthRange(year, month);
  const rows = await adminPrisma.dailyProfessionalMetrics.findMany({
    where: {
      organizationId,
      professionalId,
      date: { gte: range.from, lte: range.to },
    },
    orderBy: { date: "asc" },
  });

  const completed = rows.reduce((s, r) => s + r.appointmentsCompleted, 0);
  const noShow = rows.reduce((s, r) => s + r.appointmentsNoShow, 0);
  const slotsAvail = rows.reduce((s, r) => s + r.slotsAvailable, 0);
  const slotsOcc = rows.reduce((s, r) => s + r.slotsOccupied, 0);
  const revenue = rows.reduce((s, r) => s + r.revenueCents, 0);

  const commission = await adminPrisma.commissionStatement.aggregate({
    where: {
      organizationId,
      professionalId,
      periodStart: { gte: range.from },
      periodEnd: { lte: range.to },
    },
    _sum: { totalCents: true },
  });

  return {
    completed,
    noShowRate: completed + noShow ? Math.round((noShow / (completed + noShow)) * 100) : 0,
    occupationPct: slotsAvail ? Math.round((slotsOcc / slotsAvail) * 100) : 0,
    revenueCents: revenue,
    commissionCents: commission._sum.totalCents ?? 0,
    weekly: rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      completed: r.appointmentsCompleted,
    })),
  };
}

export async function getReceptionTodayDashboard(db: TenantClient, organizationId: string) {
  const todayKey = toSpDateKey(new Date());
  const start = new Date(`${todayKey}T03:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const [queue, confirmations, birthdays, onlinePending] = await Promise.all([
    db.appointment.findMany({
      where: {
        organizationId,
        startsAt: { gte: start, lte: end },
        status: { in: ["AGUARDANDO", "CONFIRMADO", "AGENDADO"] },
      },
      include: {
        patient: { select: { fullName: true } },
        professional: { select: { displayName: true } },
      },
      orderBy: { queueNumber: "asc" },
    }),
    db.appointmentConfirmation.count({
      where: { organizationId, status: "PENDENTE" },
    }),
    db.patient.findMany({
      where: { organizationId, isActive: true, birthDate: { not: null } },
      select: { id: true, fullName: true, birthDate: true },
    }),
    db.appointment.count({
      where: {
        organizationId,
        origin: "ONLINE",
        onlineApprovalStatus: "PENDENTE",
      },
    }),
  ]);

  const bdayMonth = start.getUTCMonth() + 1;
  const bdayDay = start.getUTCDate();
  const todayBirthdays = birthdays.filter((p) => {
    if (!p.birthDate) return false;
    return p.birthDate.getUTCMonth() + 1 === bdayMonth && p.birthDate.getUTCDate() === bdayDay;
  });

  return { queue, pendingConfirmations: confirmations, onlinePending, todayBirthdays };
}

export function dashboardForRole(role: Role): "executive" | "professional" | "reception" | "simple" {
  if (role === "PROFISSIONAL_SAUDE") return "professional";
  if (role === "RECEPCAO") return "reception";
  if (role === "OWNER" || role === "ADMIN" || role === "FINANCEIRO") return "executive";
  return "simple";
}
