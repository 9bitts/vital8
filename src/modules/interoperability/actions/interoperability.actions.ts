"use server";

import { requireAuth, mapAuthError, type ActionResult } from "@/lib/auth/guards";
import { hasOrgFeature } from "@/lib/features/subscription.service";
import {
  listRndsCredentials,
  testRndsConnection,
  upsertRndsCredential,
} from "../services/rnds-credential.service";
import {
  enqueueRndsSubmission,
  getOrCreateInteropSettings,
  listRndsSubmissions,
  retryRndsSubmission,
  updateInteropSettings,
} from "../services/rnds-submission.service";
import {
  listPendingReconciliations,
  manualReconcile,
  sendExamRequestToLab,
  simulateLabResult,
} from "../services/lab-reconciliation.service";
import { reconcileLabResult } from "../services/lab-reconciliation.service";

async function assertInterop(orgId: string) {
  const ok = await hasOrgFeature(orgId, "interoperability");
  if (!ok) throw new Error("Interoperabilidade disponível no plano ENTERPRISE");
}

export async function getInteroperabilityDashboardAction() {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN", "PROFISSIONAL_SAUDE"]);
    await assertInterop(ctx.organizationId);

    const [credentials, submissions, settings, reconciliations] = await Promise.all([
      listRndsCredentials(ctx.db, ctx.organizationId),
      listRndsSubmissions(ctx.db, ctx.organizationId),
      getOrCreateInteropSettings(ctx.db, ctx.organizationId),
      ctx.role === "PROFISSIONAL_SAUDE" || ctx.role === "ADMIN" || ctx.role === "OWNER"
        ? listPendingReconciliations(ctx.db, ctx.organizationId)
        : Promise.resolve([]),
    ]);

    return {
      success: true as const,
      data: { credentials, submissions, settings, reconciliations },
    };
  } catch (err) {
    return mapAuthError(err);
  }
}

export async function saveRndsCredentialAction(input: {
  branchId?: string | null;
  certificateType: "A1" | "A3";
  certificateBase64?: string | null;
  certificateReference?: string | null;
  requesterId: string;
  environment: "HOMOLOGACAO" | "PRODUCAO";
  credentialStatus?: "PENDENTE" | "HOMOLOGACAO" | "PRODUCAO" | "REVOGADO";
}): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    await assertInterop(ctx.organizationId);

    const cred = await upsertRndsCredential(ctx.db, ctx.organizationId, input);
    return { success: true, data: { id: cred.id } };
  } catch (err) {
    if (err instanceof Error) return { success: false, error: err.message };
    return { success: false, error: "Erro inesperado" };
  }
}

export async function testRndsConnectionAction(credentialId: string): Promise<ActionResult<{ ok: boolean; message: string }>> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    await assertInterop(ctx.organizationId);
    const result = await testRndsConnection(ctx.db, ctx.organizationId, credentialId);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof Error) return { success: false, error: err.message };
    return { success: false, error: "Erro inesperado" };
  }
}

export async function saveInteropSettingsAction(input: {
  autoSendRac?: boolean;
  autoSendExamResults?: boolean;
  examResultDeadlineHours?: number;
  labIntegrationEnabled?: boolean;
  labPollingEnabled?: boolean;
  labPollingIntervalMinutes?: number;
}): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    await assertInterop(ctx.organizationId);
    await updateInteropSettings(ctx.db, ctx.organizationId, input);
    return { success: true };
  } catch (err) {
    return mapAuthError(err);
  }
}

export async function retrySubmissionAction(submissionId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["ADMIN", "OWNER"]);
    await assertInterop(ctx.organizationId);
    await retryRndsSubmission(ctx.db, ctx.organizationId, submissionId);
    return { success: true };
  } catch (err) {
    if (err instanceof Error) return { success: false, error: err.message };
    return { success: false, error: "Erro inesperado" };
  }
}

export async function enqueueRacSubmissionAction(encounterId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuth(["ADMIN", "OWNER"]);
    await assertInterop(ctx.organizationId);
    const sub = await enqueueRndsSubmission(ctx.db, ctx.organizationId, {
      registrationType: "RAC",
      sourceType: "ENCOUNTER",
      sourceId: encounterId,
    });
    return { success: true, data: { id: sub.id } };
  } catch (err) {
    if (err instanceof Error) return { success: false, error: err.message };
    return { success: false, error: "Erro inesperado" };
  }
}

export async function manualReconcileAction(
  reconciliationId: string,
  requestId: string,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["ADMIN", "OWNER", "PROFISSIONAL_SAUDE"]);
    await assertInterop(ctx.organizationId);
    await manualReconcile(ctx.db, ctx.organizationId, reconciliationId, requestId);
    return { success: true };
  } catch (err) {
    return mapAuthError(err);
  }
}

export async function simulateLabFlowAction(requestId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    await assertInterop(ctx.organizationId);
    await sendExamRequestToLab(ctx.db, ctx.organizationId, requestId);
    const payload = await simulateLabResult(requestId);
    await reconcileLabResult(ctx.db, ctx.organizationId, payload);
    return { success: true };
  } catch (err) {
    return mapAuthError(err);
  }
}
