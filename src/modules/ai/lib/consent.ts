import type { AiResourceType } from "@/generated/prisma/client";
import { adminPrisma } from "@/lib/db/admin-client";

export const AI_TERM_VERSION = "2026-07-12";

export const AI_RESOURCE_LABELS: Record<AiResourceType, string> = {
  VIRTUAL_SECRETARY: "Secretária virtual (WhatsApp/chat)",
  CLINICAL_COPILOT: "Copiloto clínico (atendimento)",
  SMART_COLLECTION: "Cobrança inteligente",
  NO_SHOW_SCORING: "Score de no-show",
  BI_INSIGHTS: "Insights do BI",
  GLOSA_DRAFT: "Rascunho de recurso de glosa",
  SMART_SEARCH: "Busca inteligente global",
};

export async function hasAiConsent(
  organizationId: string,
  resource: AiResourceType,
): Promise<boolean> {
  const row = await adminPrisma.aiDataProcessingConsent.findUnique({
    where: { organizationId_resource: { organizationId, resource } },
  });
  return Boolean(row && !row.revokedAt);
}

export async function requireAiConsent(organizationId: string, resource: AiResourceType) {
  const ok = await hasAiConsent(organizationId, resource);
  if (!ok) {
    throw new Error(
      `Consentimento LGPD para ${AI_RESOURCE_LABELS[resource]} não habilitado pelo OWNER`,
    );
  }
}

export async function isAiResourceEnabled(
  organizationId: string,
  resource: AiResourceType,
): Promise<boolean> {
  const settings = await adminPrisma.aiSettings.findUnique({ where: { organizationId } });
  if (!settings) return false;
  const enabled = settings.enabledResources as Record<string, boolean>;
  return Boolean(enabled[resource]);
}
