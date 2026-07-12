"use server";

import { revalidatePath } from "next/cache";
import {
  requireAuth,
  type ActionResult,
  mapAuthError,
} from "@/lib/auth/guards";
import {
  completeOnboardingStep,
  getOnboardingProgress,
  onboardingChecklist,
  type OnboardingStep,
} from "../services/onboarding.service";
import {
  getExportByToken,
  processOrganizationExport,
  requestOrganizationExport,
} from "../services/export.service";

export async function getOnboardingAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  const progress = await getOnboardingProgress(ctx.organizationId);
  const steps = progress.steps as Record<string, boolean>;
  return {
    checklist: onboardingChecklist(steps),
    completedAt: progress.completedAt,
  };
}

export async function completeOnboardingStepAction(step: OnboardingStep): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    await completeOnboardingStep(ctx.organizationId, step);
    revalidatePath("/app/onboarding");
    revalidatePath("/app/dashboard");
    return { success: true, data: undefined };
  } catch (e) {
    return mapAuthError(e);
  }
}

export async function requestExportAction(): Promise<ActionResult<{ exportId: string }>> {
  try {
    const ctx = await requireAuth(["OWNER"]);
    const exp = await requestOrganizationExport(ctx.organizationId, ctx.userId);
    await processOrganizationExport(exp.id);
    return { success: true, data: { exportId: exp.id } };
  } catch (e) {
    return mapAuthError(e) as ActionResult<{ exportId: string }>;
  }
}

export async function getExportDownloadAction(token: string) {
  const ctx = await requireAuth(["OWNER"]);
  const exp = await getExportByToken(token);
  if (!exp || exp.organizationId !== ctx.organizationId) return null;
  return { token: exp.downloadToken, storageKey: exp.storageKey };
}
