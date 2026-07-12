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
  | "patient_portal"
  | "public_api"
  | "webhooks"
  | "ai"
  | "interoperability"
  | "pwa"
  | "marketing";

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
    "tiss",
    "bi",
    "online_scheduling",
    "patient_portal",
    "public_api",
    "pwa",
    "marketing",
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
    "interoperability",
    "pwa",
    "marketing",
  ],
};

export function hasFeature(plan: Plan, feature: FeatureFlag): boolean {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false;
}

export function getPlanFeatures(plan: Plan): FeatureFlag[] {
  return PLAN_FEATURES[plan] ?? [];
}
