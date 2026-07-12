import type { TenantClient } from "@/lib/db/tenant-client";

const ATTENDED_STATUSES = ["FINALIZADO", "EM_ATENDIMENTO", "CONFIRMADO"] as const;

export type ReactivationPatient = {
  patientId: string;
  fullName: string;
  phoneSearch: string | null;
  lastAppointmentAt: Date | null;
  monthsInactive: number;
};

export function monthsSince(date: Date | null, now = new Date()): number {
  if (!date) return Infinity;
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (30 * 86400_000));
}

export async function listInactivePatients(
  db: TenantClient,
  organizationId: string,
  inactiveMonths = 6,
): Promise<ReactivationPatient[]> {
  const patients = await db.patient.findMany({
    where: { organizationId, isActive: true, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      phoneSearch: true,
      appointments: {
        where: { status: { in: [...ATTENDED_STATUSES] } },
        orderBy: { startsAt: "desc" },
        take: 1,
        select: { startsAt: true },
      },
    },
  });

  const now = new Date();
  return patients
    .map((p) => {
      const last = p.appointments[0]?.startsAt ?? null;
      const months = monthsSince(last, now);
      return {
        patientId: p.id,
        fullName: p.fullName,
        phoneSearch: p.phoneSearch,
        lastAppointmentAt: last,
        monthsInactive: months,
      };
    })
    .filter((p) => p.monthsInactive >= inactiveMonths)
    .sort((a, b) => b.monthsInactive - a.monthsInactive);
}

export type ReactivationReport = {
  inactiveMonths: number;
  totalInactive: number;
  contacted: number;
  returned: number;
  patients: ReactivationPatient[];
};

export async function getReactivationReport(
  db: TenantClient,
  organizationId: string,
  inactiveMonths = 6,
): Promise<ReactivationReport> {
  const patients = await listInactivePatients(db, organizationId, inactiveMonths);

  const campaignTag = `reativacao-${inactiveMonths}m`;
  const contacted = await db.lead.count({
    where: {
      organizationId,
      utmCampaign: campaignTag,
      status: { in: ["EM_CONTATO", "AGENDOU", "COMPARECEU", "CONVERTIDO"] },
    },
  });

  const returned = await db.appointment.count({
    where: {
      organizationId,
      patientId: { in: patients.map((p) => p.patientId) },
      origin: "ONLINE",
      createdAt: { gte: new Date(Date.now() - 90 * 86400_000) },
      status: { in: ["CONFIRMADO", "FINALIZADO", "AGENDADO"] },
    },
  });

  return {
    inactiveMonths,
    totalInactive: patients.length,
    contacted,
    returned,
    patients: patients.slice(0, 50),
  };
}
