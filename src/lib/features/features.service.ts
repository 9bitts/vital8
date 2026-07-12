import type { Plan } from "@/generated/prisma/client";

export type FeatureFlag =
  | "patients"
  | "appointments"
  | "clinical_records"
  | "financial"
  | "inventory"
  | "tiss"
  | "bi"
  | "telemedicine"
  | "online_scheduling"
  | "patient_portal";

const PLAN_FEATURES: Record<Plan, FeatureFlag[]> = {
  TRIAL: [
    "patients",
    "appointments",
    "clinical_records",
    "financial",
    "online_scheduling",
  ],
  STARTER: ["patients", "appointments", "clinical_records", "financial"],
  PRO: [
    "patients",
    "appointments",
    "clinical_records",
    "financial",
    "inventory",
    "bi",
    "online_scheduling",
    "patient_portal",
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
  ],
};

export function hasFeature(plan: Plan, feature: FeatureFlag): boolean {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false;
}

export function getPlanFeatures(plan: Plan): FeatureFlag[] {
  return PLAN_FEATURES[plan] ?? [];
}
