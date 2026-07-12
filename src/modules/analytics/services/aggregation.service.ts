import type { Prisma } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";
import { isOccupyingStatus } from "@/modules/scheduling/services/conflict.service";
import { generateDaySlots } from "@/modules/scheduling/services/slot.service";
import { eachSpDateKey, spDayUtcBounds, toSpDateKey } from "../lib/periods";

const WEEKDAY_MAP = [
  "DOMINGO",
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
] as const;

async function countSlotsForProfessional(
  organizationId: string,
  professionalId: string,
  dayStart: Date,
) {
  const templates = await adminPrisma.scheduleTemplate.findMany({
    where: { organizationId, professionalId },
  });
  const weekday = WEEKDAY_MAP[dayStart.getUTCDay()] ?? "SEGUNDA";
  const dayTemplates = templates.filter((t) => t.weekday === weekday);
  const holiday = await adminPrisma.holiday.findFirst({
    where: { organizationId, date: dayStart },
  });
  if (holiday || dayTemplates.length === 0) return { available: 0, occupied: 0 };

  const dayEnd = new Date(dayStart);
  dayEnd.setUTCHours(dayEnd.getUTCHours() + 23);

  const appointments = await adminPrisma.appointment.findMany({
    where: {
      organizationId,
      professionalId,
      startsAt: { gte: dayStart, lte: dayEnd },
    },
  });

  let available = 0;
  let occupied = 0;
  for (const tmpl of dayTemplates) {
    const slots = generateDaySlots(dayStart, [tmpl], 30);
    available += slots.length;
    for (const slot of slots) {
      if (
        appointments.some(
          (a) =>
            isOccupyingStatus(a.status) &&
            a.startsAt < slot.endsAt &&
            a.endsAt > slot.startsAt,
        )
      ) {
        occupied += 1;
      }
    }
  }
  return { available, occupied };
}

export async function computeOrgDayMetrics(
  organizationId: string,
  dateKey: string,
): Promise<Prisma.DailyOrgMetricsCreateInput> {
  const { start, end } = spDayUtcBounds(dateKey);
  const date = new Date(`${dateKey}T12:00:00.000Z`);

  const appointments = await adminPrisma.appointment.findMany({
    where: { organizationId, startsAt: { gte: start, lte: end } },
  });

  const completed = appointments.filter((a) => a.status === "FINALIZADO");
  const noShow = appointments.filter((a) => a.status === "FALTOU");
  const cancelled = appointments.filter((a) => a.status === "CANCELADO");
  const scheduled = appointments.filter((a) =>
    ["AGENDADO", "CONFIRMADO", "AGUARDANDO", "EM_ATENDIMENTO", "FINALIZADO"].includes(
      a.status,
    ),
  );
  const confirmed = appointments.filter((a) =>
    ["CONFIRMADO", "AGUARDANDO", "EM_ATENDIMENTO", "FINALIZADO"].includes(a.status),
  );

  const waitTimes = completed
    .filter((a) => a.arrivedAt && a.startedAt)
    .map((a) => (a.startedAt!.getTime() - a.arrivedAt!.getTime()) / 60000);
  const encounterTimes = completed
    .filter((a) => a.startedAt && a.finishedAt)
    .map((a) => (a.finishedAt!.getTime() - a.startedAt!.getTime()) / 60000);

  const professionals = await adminPrisma.professional.findMany({
    where: { organizationId, isActive: true },
    select: { id: true },
  });
  let slotsAvailable = 0;
  let slotsOccupied = 0;
  for (const p of professionals) {
    const s = await countSlotsForProfessional(organizationId, p.id, start);
    slotsAvailable += s.available;
    slotsOccupied += s.occupied;
  }

  const newPatients = await adminPrisma.patient.count({
    where: { organizationId, createdAt: { gte: start, lte: end } },
  });

  const payments = await adminPrisma.payment.findMany({
    where: { organizationId, createdAt: { gte: start, lte: end } },
  });
  const sales = await adminPrisma.sale.findMany({
    where: {
      organizationId,
      createdAt: { gte: start, lte: end },
      status: "CONFIRMADA",
    },
  });
  const payables = await adminPrisma.payable.findMany({
    where: {
      organizationId,
      competenceDate: { gte: start, lte: end },
      status: "PAGO",
    },
  });

  const npsResponses = await adminPrisma.npsResponse.findMany({
    where: { organizationId, respondedAt: { gte: start, lte: end } },
  });

  const overdue = await adminPrisma.receivable.aggregate({
    where: {
      organizationId,
      status: { in: ["ABERTO", "PARCIAL", "VENCIDO"] },
      dueDate: { lt: end },
    },
    _sum: { totalCents: true, paidCents: true },
  });

  const paymentByMethod: Record<string, number> = {};
  for (const p of payments) {
    paymentByMethod[p.method] = (paymentByMethod[p.method] ?? 0) + p.netAmountCents;
  }

  const stockMovements = await adminPrisma.stockMovement.findMany({
    where: {
      organizationId,
      movementType: "SAIDA_PERDA",
      createdAt: { gte: start, lte: end },
    },
  });

  const balances = await adminPrisma.stockBalance.findMany({
    where: { organizationId },
    include: { product: true },
  });
  let inventoryValue = 0;
  let critical = 0;
  for (const b of balances) {
    inventoryValue += b.quantity * b.product.averageCostCents;
    if (b.product.minStock > 0 && b.quantity <= b.product.minStock) critical += 1;
  }

  return {
    organization: { connect: { id: organizationId } },
    date,
    appointmentsCompleted: completed.length,
    appointmentsNoShow: noShow.length,
    appointmentsCancelled: cancelled.length,
    appointmentsScheduled: scheduled.length,
    appointmentsConfirmed: confirmed.length,
    slotsAvailable,
    slotsOccupied,
    avgWaitMinutes: waitTimes.length
      ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
      : null,
    avgEncounterMinutes: encounterTimes.length
      ? encounterTimes.reduce((a, b) => a + b, 0) / encounterTimes.length
      : null,
    originRecepcao: appointments.filter((a) => a.origin === "RECEPCAO").length,
    originTelefone: appointments.filter((a) => a.origin === "TELEFONE").length,
    originOnline: appointments.filter((a) => a.origin === "ONLINE").length,
    newPatients,
    npsAvg: npsResponses.length
      ? npsResponses.reduce((s, r) => s + r.score, 0) / npsResponses.length
      : null,
    npsCount: npsResponses.length,
    revenueReceivedCents: payments.reduce((s, p) => s + p.netAmountCents, 0),
    revenueBilledCents: sales.reduce((s, x) => s + x.totalCents, 0),
    expensesCents: payables.reduce((s, p) => s + p.amountCents, 0),
    discountsCents: sales.reduce((s, x) => s + x.discountCents, 0),
    overdueCents:
      (overdue._sum.totalCents ?? 0) - (overdue._sum.paidCents ?? 0),
    inventoryValueCents: inventoryValue,
    inventoryLossCents: stockMovements.reduce(
      (s, m) => s + m.quantity * m.unitCostCents,
      0,
    ),
    criticalStockCount: critical,
    paymentByMethod,
  };
}

export async function upsertOrgDayMetrics(organizationId: string, dateKey: string) {
  const data = await computeOrgDayMetrics(organizationId, dateKey);
  const { organization, ...metrics } = data;
  void organization;
  return adminPrisma.dailyOrgMetrics.upsert({
    where: {
      organizationId_date: { organizationId, date: data.date as Date },
    },
    create: { organizationId, ...metrics, date: data.date as Date },
    update: metrics,
  });
}

export async function upsertProfessionalDayMetrics(
  organizationId: string,
  professionalId: string,
  dateKey: string,
) {
  const { start, end } = spDayUtcBounds(dateKey);
  const date = new Date(`${dateKey}T12:00:00.000Z`);

  const appointments = await adminPrisma.appointment.findMany({
    where: { organizationId, professionalId, startsAt: { gte: start, lte: end } },
  });
  const slots = await countSlotsForProfessional(organizationId, professionalId, start);

  const completed = appointments.filter((a) => a.status === "FINALIZADO");
  const waitTimes = completed
    .filter((a) => a.arrivedAt && a.startedAt)
    .map((a) => (a.startedAt!.getTime() - a.arrivedAt!.getTime()) / 60000);
  const encounterTimes = completed
    .filter((a) => a.startedAt && a.finishedAt)
    .map((a) => (a.finishedAt!.getTime() - a.startedAt!.getTime()) / 60000);

  const payments = await adminPrisma.payment.findMany({
    where: {
      organizationId,
      createdAt: { gte: start, lte: end },
      sale: { professionalId },
    },
  });

  const metrics = {
    appointmentsCompleted: completed.length,
    appointmentsNoShow: appointments.filter((a) => a.status === "FALTOU").length,
    appointmentsCancelled: appointments.filter((a) => a.status === "CANCELADO").length,
    slotsAvailable: slots.available,
    slotsOccupied: slots.occupied,
    avgWaitMinutes: waitTimes.length
      ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
      : null,
    avgEncounterMinutes: encounterTimes.length
      ? encounterTimes.reduce((a, b) => a + b, 0) / encounterTimes.length
      : null,
    revenueCents: payments.reduce((s, p) => s + p.netAmountCents, 0),
    commissionCents: 0,
    npsCount: 0,
    npsAvg: null as number | null,
  };

  return adminPrisma.dailyProfessionalMetrics.upsert({
    where: {
      organizationId_professionalId_date: { organizationId, professionalId, date },
    },
    create: { organizationId, professionalId, date, ...metrics },
    update: metrics,
  });
}

export async function reprocessMetricsRange(
  organizationId: string,
  from: Date,
  to: Date,
) {
  const keys = eachSpDateKey(from, to);
  const professionals = await adminPrisma.professional.findMany({
    where: { organizationId, isActive: true },
    select: { id: true },
  });
  let count = 0;
  for (const key of keys) {
    await upsertOrgDayMetrics(organizationId, key);
    for (const p of professionals) {
      await upsertProfessionalDayMetrics(organizationId, p.id, key);
    }
    count += 1;
  }
  return { daysProcessed: count };
}

/** Cálculo direto (live) para validação de consistência. */
export async function computeLiveOrgTotals(
  organizationId: string,
  from: Date,
  to: Date,
) {
  const keys = eachSpDateKey(from, to);
  let completed = 0;
  let received = 0;
  for (const key of keys) {
    const m = await computeOrgDayMetrics(organizationId, key);
    completed += m.appointmentsCompleted as number;
    received += m.revenueReceivedCents as number;
  }
  return { appointmentsCompleted: completed, revenueReceivedCents: received };
}

export async function sumAggregatedOrgTotals(
  organizationId: string,
  from: Date,
  to: Date,
) {
  const rows = await adminPrisma.dailyOrgMetrics.findMany({
    where: {
      organizationId,
      date: { gte: from, lte: to },
    },
  });
  return {
    appointmentsCompleted: rows.reduce((s, r) => s + r.appointmentsCompleted, 0),
    revenueReceivedCents: rows.reduce((s, r) => s + r.revenueReceivedCents, 0),
  };
}

export { toSpDateKey };
