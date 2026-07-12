import type { SubscriptionPlan, SubscriptionStatus } from "@/generated/prisma/client";
import type { Plan } from "@/generated/prisma/client";
import type { FeatureFlag } from "@/lib/features/features.service";

export type PlanLimits = {
  maxUsers: number;
  maxBranches: number;
  maxActivePatients: number;
};

export const SUBSCRIPTION_PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  BASICO: { maxUsers: 5, maxBranches: 1, maxActivePatients: 500 },
  PRO: { maxUsers: 20, maxBranches: 3, maxActivePatients: 5000 },
  ENTERPRISE: { maxUsers: 100, maxBranches: 20, maxActivePatients: 50000 },
};

export const PLAN_PRICING_CENTS: Record<SubscriptionPlan, { monthly: number; annual: number }> = {
  BASICO: { monthly: 19900, annual: 199000 },
  PRO: { monthly: 49900, annual: 499000 },
  ENTERPRISE: { monthly: 99900, annual: 999000 },
};

export function subscriptionPlanToOrgPlan(plan: SubscriptionPlan): Plan {
  switch (plan) {
    case "BASICO":
      return "STARTER";
    case "PRO":
      return "PRO";
    case "ENTERPRISE":
      return "ENTERPRISE";
  }
}

export function isSubscriptionWritable(status: SubscriptionStatus): boolean {
  return status === "TRIAL" || status === "ATIVA" || status === "INADIMPLENTE";
}

export function isSubscriptionReadOnly(status: SubscriptionStatus, gracePeriodEndsAt: Date | null): boolean {
  if (status === "CANCELADA") return true;
  if (status === "INADIMPLENTE" && gracePeriodEndsAt && gracePeriodEndsAt < new Date()) return true;
  return false;
}

export const SUBSCRIPTION_FEATURES: Record<SubscriptionPlan, FeatureFlag[]> = {
  BASICO: ["patients", "appointments", "clinical_records", "financial"],
  PRO: [
    "patients",
    "appointments",
    "clinical_records",
    "financial",
    "inventory",
    "tiss",
    "bi",
    "online_scheduling",
    "patient_portal",
    "public_api",
  ],
  ENTERPRISE: [
    "patients",
    "appointments",
    "clinical_records",
    "financial",
    "inventory",
    "tiss",
    "bi",
    "telemedicine",
    "online_scheduling",
    "patient_portal",
    "public_api",
    "webhooks",
    "ai",
  ],
};
