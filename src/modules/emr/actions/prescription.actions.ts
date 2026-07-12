"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, type ActionResult } from "@/lib/auth/guards";
import { createAuditLog } from "@/modules/core/services/audit.service";
import { getPrescriptionProvider } from "@/lib/integrations/prescription-provider";
import { prescriptionSettingsSchema } from "@/modules/emr/schemas/prescription.schema";
import {
  getOrCreatePrescriptionSettings,
  maskPrescriptionSettings,
  savePrescriptionSettings,
  decryptMemedApiKey,
} from "@/modules/emr/services/prescription-settings.service";
import { checkPrescriptionSafety } from "@/modules/emr/services/prescription-safety.service";
import { sendPrescriptionToPatient } from "@/modules/emr/services/prescription-delivery.service";
import { prescriptionItemSchema } from "@/modules/emr/schemas/emr.schema";
import { z } from "zod";

export async function getPrescriptionSettingsAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  const settings = await getOrCreatePrescriptionSettings(ctx.db, ctx.organizationId);
  return maskPrescriptionSettings(settings);
}

export async function savePrescriptionSettingsAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    prescriptionSettingsSchema.parse(input);
    await savePrescriptionSettings(ctx.db, ctx.organizationId, input);
    await createAuditLog({
      action: "prescription.settings.update",
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      entityType: "PrescriptionSettings",
      entityId: ctx.organizationId,
    });
    revalidatePath("/app/configuracoes/prontuario");
    return { success: true };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao salvar configurações" };
  }
}

const safetyPreviewSchema = z.object({
  patientId: z.string(),
  items: z.array(prescriptionItemSchema).min(1),
});

export async function previewPrescriptionSafetyAction(input: unknown) {
  const ctx = await requireAuth([
    "OWNER",
    "ADMIN",
    "PROFISSIONAL_SAUDE",
  ]);
  const parsed = safetyPreviewSchema.parse(input);
  return checkPrescriptionSafety(
    ctx.db,
    ctx.organizationId,
    parsed.patientId,
    parsed.items,
  );
}

export async function sendPrescriptionToPatientAction(
  prescriptionId: string,
): Promise<ActionResult<{ validationUrl: string }>> {
  try {
    const ctx = await requireAuth([
      "OWNER",
      "ADMIN",
      "PROFISSIONAL_SAUDE",
      "RECEPCAO",
    ]);
    const result = await sendPrescriptionToPatient(
      ctx.db,
      ctx.organizationId,
      prescriptionId,
    );
    return { success: true, data: { validationUrl: result.validationUrl } };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao enviar receita" };
  }
}

export async function createMemedEmbedSessionAction(encounterId: string) {
  const ctx = await requireAuth(["PROFISSIONAL_SAUDE", "OWNER", "ADMIN"]);
  const settings = await getOrCreatePrescriptionSettings(ctx.db, ctx.organizationId);
  const encounter = await ctx.db.encounter.findFirstOrThrow({
    where: { id: encounterId },
    include: { patient: true, professional: true },
  });

  const provider = getPrescriptionProvider(settings.provider);
  if (!provider.createEmbedSession) {
    throw new Error("Provider não suporta embed");
  }

  return provider.createEmbedSession({
    organizationId: ctx.organizationId,
    professionalId: encounter.professionalId,
    professionalName: encounter.professional.displayName,
    patientExternalId: encounter.patientId,
    patientName: encounter.patient.socialName ?? encounter.patient.fullName,
    memedPartnerId: settings.memedPartnerId ?? undefined,
    memedApiKey: decryptMemedApiKey(settings) ?? undefined,
  });
}

export async function searchDrugsWithProviderAction(query: string) {
  const ctx = await requireAuth([
    "OWNER",
    "ADMIN",
    "PROFISSIONAL_SAUDE",
  ]);
  const settings = await getOrCreatePrescriptionSettings(ctx.db, ctx.organizationId);
  return getPrescriptionProvider(settings.provider).searchDrugs(query);
}
