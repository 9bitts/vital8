"use server";

import { requireAuth, mapAuthError, type ActionResult } from "@/lib/auth/guards";
import {
  getWhatsAppReadiness,
  probeWhatsAppGraph,
} from "@/lib/integrations/messaging";
import type { WhatsAppReadiness } from "@/lib/integrations/messaging/whatsapp-readiness";

export async function getWhatsAppStatusAction(): Promise<
  ActionResult<WhatsAppReadiness>
> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    const readiness = await getWhatsAppReadiness(ctx.organizationId);
    return { success: true, data: readiness };
  } catch (e) {
    return mapAuthError(e) as ActionResult<WhatsAppReadiness>;
  }
}

export async function probeWhatsAppAction(): Promise<
  ActionResult<{ ok: boolean; detail: string }>
> {
  try {
    const ctx = await requireAuth(["OWNER", "ADMIN"]);
    const result = await probeWhatsAppGraph(ctx.organizationId);
    return { success: true, data: result };
  } catch (e) {
    return mapAuthError(e) as ActionResult<{ ok: boolean; detail: string }>;
  }
}
