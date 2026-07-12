import type { FeatureFlag } from "./features.service";
import type { Plan } from "@/generated/prisma/client";
import {
  SUBSCRIPTION_FEATURES,
  SUBSCRIPTION_PLAN_LIMITS,
  isSubscriptionReadOnly,
  isSubscriptionWritable,
  subscriptionPlanToOrgPlan,
  type PlanLimits,
} from "./subscription-plans";
import { adminPrisma } from "@/lib/db/admin-client";

export type SubscriptionContext = {
  plan: Plan;
  subscriptionPlan: import("@/generated/prisma/client").SubscriptionPlan;
  status: import("@/generated/prisma/client").SubscriptionStatus;
  limits: PlanLimits;
  features: FeatureFlag[];
  readOnly: boolean;
  trialEndsAt: Date | null;
};

export async function getSubscriptionContext(organizationId: string): Promise<SubscriptionContext> {
  const sub = await adminPrisma.subscription.findUnique({
    where: { organizationId },
  });

  if (!sub) {
    const org = await adminPrisma.organization.findFirstOrThrow({ where: { id: organizationId } });
    return {
      plan: org.plan,
      subscriptionPlan: org.plan === "STARTER" ? "BASICO" : org.plan === "PRO" ? "PRO" : "ENTERPRISE",
      status: org.plan === "TRIAL" ? "TRIAL" : "ATIVA",
      limits: SUBSCRIPTION_PLAN_LIMITS.BASICO,
      features: SUBSCRIPTION_FEATURES.BASICO,
      readOnly: false,
      trialEndsAt: org.trialEndsAt,
    };
  }

  const plan = subscriptionPlanToOrgPlan(sub.plan);
  const readOnly = isSubscriptionReadOnly(sub.status, sub.gracePeriodEndsAt);

  return {
    plan,
    subscriptionPlan: sub.plan,
    status: sub.status,
    limits: SUBSCRIPTION_PLAN_LIMITS[sub.plan],
    features: SUBSCRIPTION_FEATURES[sub.plan],
    readOnly,
    trialEndsAt: sub.trialEndsAt,
  };
}

export async function hasOrgFeature(organizationId: string, feature: FeatureFlag): Promise<boolean> {
  const ctx = await getSubscriptionContext(organizationId);
  if (ctx.readOnly && feature !== "patients") {
    return ctx.features.includes(feature);
  }
  return ctx.features.includes(feature);
}

export async function checkLimit(
  organizationId: string,
  kind: keyof PlanLimits,
): Promise<{ ok: boolean; current: number; max: number }> {
  const ctx = await getSubscriptionContext(organizationId);
  const max = ctx.limits[kind === "maxUsers" ? "maxUsers" : kind === "maxBranches" ? "maxBranches" : "maxActivePatients"];

  let current = 0;
  if (kind === "maxUsers") {
    current = await adminPrisma.membership.count({
      where: { organizationId, isActive: true },
    });
  } else if (kind === "maxBranches") {
    current = await adminPrisma.branch.count({
      where: { organizationId, isActive: true },
    });
  } else {
    current = await adminPrisma.patient.count({
      where: { organizationId, isActive: true, anonymizedAt: null },
    });
  }

  return { ok: current < max, current, max };
}

export async function assertWritableSubscription(organizationId: string): Promise<void> {
  const ctx = await getSubscriptionContext(organizationId);
  if (ctx.readOnly) {
    throw new Error("Assinatura inadimplente — modo somente leitura");
  }
  if (!isSubscriptionWritable(ctx.status) && ctx.status !== "INADIMPLENTE") {
    throw new Error("Assinatura cancelada");
  }
}

/** @deprecated use hasOrgFeature — mantido para compatibilidade */
export { hasFeature, getPlanFeatures } from "./features.service";
