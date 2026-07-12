"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, type ActionResult } from "@/lib/auth/guards";
import { createAuditLog } from "@/modules/core/services/audit.service";
import { signatureSettingsSchema } from "@/modules/emr/schemas/signature.schema";
import {
  getOrCreateSignatureSettings,
  maskSignatureSettings,
  saveSignatureSettings,
} from "@/modules/emr/services/signature-settings.service";
import { verifyByCode } from "@/modules/emr/services/verify.service";

export async function getSignatureSettingsAction() {
  const ctx = await requireAuth(["OWNER", "ADMIN"]);
  const settings = await getOrCreateSignatureSettings(ctx.db, ctx.organizationId);
  return maskSignatureSettings(settings);
}

export async function saveSignatureSettingsAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    signatureSettingsSchema.parse(input);
    await saveSignatureSettings(ctx.db, ctx.organizationId, input);
    await createAuditLog({
      action: "signature.settings.update",
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      entityType: "SignatureSettings",
      entityId: ctx.organizationId,
    });
    revalidatePath("/app/configuracoes/prontuario");
    return { success: true };
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message };
    return { success: false, error: "Erro ao salvar configurações de assinatura" };
  }
}

export async function verifyDocumentAction(code: string) {
  return verifyByCode(code);
}
