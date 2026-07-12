import type { TenantClient } from "@/lib/db/tenant-client";
import { adminPrisma } from "@/lib/db/admin-client";

export async function getOrCreateReferralProgram(
  db: TenantClient,
  organizationId: string,
) {
  const existing = await db.referralProgram.findUnique({ where: { organizationId } });
  if (existing) return existing;
  return db.referralProgram.create({
    data: {
      organizationId,
      rewardType: "DESCONTO",
      rewardValue: "10% na próxima consulta",
      maxPerPatientMonth: 3,
      terms: "Recompensa creditada após comparecimento do indicado.",
    },
  });
}

export async function countReferralsThisMonth(
  db: TenantClient,
  organizationId: string,
  referrerPatientId: string,
): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return db.referral.count({
    where: {
      organizationId,
      referrerPatientId,
      createdAt: { gte: start },
    },
  });
}

export function exceedsReferralMonthlyLimit(monthlyCount: number, maxPerMonth: number): boolean {
  return monthlyCount >= maxPerMonth;
}

export async function createReferral(
  db: TenantClient,
  organizationId: string,
  referrerPatientId: string,
  referredLeadId?: string,
) {
  const program = await getOrCreateReferralProgram(db, organizationId);
  if (!program.isActive) throw new Error("Programa de indicação inativo");

  const monthly = await countReferralsThisMonth(db, organizationId, referrerPatientId);
  if (exceedsReferralMonthlyLimit(monthly, program.maxPerPatientMonth)) {
    throw new Error("Limite mensal de indicações atingido");
  }

  const dup = await db.referral.findFirst({
    where: {
      organizationId,
      referrerPatientId,
      referredLeadId: referredLeadId ?? undefined,
      status: { notIn: ["REJEITADA"] },
    },
  });
  if (dup) throw new Error("Indicação já registrada");

  return db.referral.create({
    data: {
      organizationId,
      programId: program.id,
      referrerPatientId,
      referredLeadId: referredLeadId ?? null,
      status: "PENDENTE",
    },
  });
}

export async function rewardReferralOnAttendance(
  db: TenantClient,
  organizationId: string,
  patientId: string,
) {
  const referral = await db.referral.findFirst({
    where: {
      organizationId,
      referredPatientId: patientId,
      status: { in: ["AGENDOU", "COMPARECEU", "PENDENTE"] },
    },
  });
  if (!referral || referral.status === "PREMIADA") return null;

  return db.referral.update({
    where: { id: referral.id },
    data: { status: "PREMIADA", rewardedAt: new Date() },
  });
}

export async function auditReferralAction(
  organizationId: string,
  action: string,
  referralId: string,
  metadata?: Record<string, unknown>,
) {
  return adminPrisma.auditLog.create({
    data: {
      organizationId,
      action: `referral.${action}`,
      entityType: "Referral",
      entityId: referralId,
      metadata: (metadata ?? {}) as object,
    },
  });
}
