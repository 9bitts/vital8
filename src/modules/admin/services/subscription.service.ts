import type { SubscriptionCycle, SubscriptionPlan } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";
import {
  PLAN_PRICING_CENTS,
  SUBSCRIPTION_PLAN_LIMITS,
  subscriptionPlanToOrgPlan,
} from "@/lib/features/subscription-plans";

const TRIAL_DAYS = 14;
const GRACE_DAYS = 7;

export async function ensureSubscription(organizationId: string, plan: SubscriptionPlan = "BASICO") {
  const existing = await adminPrisma.subscription.findUnique({ where: { organizationId } });
  if (existing) return existing;

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + TRIAL_DAYS);

  return adminPrisma.subscription.create({
    data: {
      id: `sub-${organizationId}`,
      organizationId,
      plan,
      status: "TRIAL",
      trialEndsAt: trialEnds,
      limits: SUBSCRIPTION_PLAN_LIMITS[plan],
    },
  });
}

export async function getSubscriptionUsage(organizationId: string) {
  const [users, branches, patients, sub] = await Promise.all([
    adminPrisma.membership.count({ where: { organizationId, isActive: true } }),
    adminPrisma.branch.count({ where: { organizationId, isActive: true } }),
    adminPrisma.patient.count({ where: { organizationId, isActive: true, anonymizedAt: null } }),
    adminPrisma.subscription.findUnique({ where: { organizationId } }),
  ]);

  const plan = sub?.plan ?? "BASICO";
  const limits = SUBSCRIPTION_PLAN_LIMITS[plan];

  return {
    subscription: sub,
    usage: { users, branches, patients },
    limits,
    pricing: PLAN_PRICING_CENTS[plan],
  };
}

export async function changePlan(
  organizationId: string,
  newPlan: SubscriptionPlan,
  cycle: SubscriptionCycle = "MONTHLY",
) {
  const amount = PLAN_PRICING_CENTS[newPlan][cycle === "ANNUAL" ? "annual" : "monthly"];
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + (cycle === "ANNUAL" ? 12 : 1));

  const sub = await adminPrisma.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      plan: newPlan,
      cycle,
      status: "ATIVA",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      limits: SUBSCRIPTION_PLAN_LIMITS[newPlan],
    },
    update: {
      plan: newPlan,
      cycle,
      status: "ATIVA",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      gracePeriodEndsAt: null,
      limits: SUBSCRIPTION_PLAN_LIMITS[newPlan],
    },
  });

  await adminPrisma.organization.update({
    where: { id: organizationId },
    data: { plan: subscriptionPlanToOrgPlan(newPlan) },
  });

  await adminPrisma.subscriptionInvoice.create({
    data: {
      subscriptionId: sub.id,
      amountCents: amount,
      status: "PAID",
      periodStart: now,
      periodEnd,
      paidAt: now,
    },
  });

  return sub;
}

export async function markInadimplente(organizationId: string) {
  const grace = new Date();
  grace.setDate(grace.getDate() + GRACE_DAYS);
  return adminPrisma.subscription.update({
    where: { organizationId },
    data: { status: "INADIMPLENTE", gracePeriodEndsAt: grace },
  });
}
