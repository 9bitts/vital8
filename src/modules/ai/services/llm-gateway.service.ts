import type { AiInteractionOutcome, AiResourceType } from "@/generated/prisma/client";
import { encryptPHI } from "@/lib/crypto/phi";
import { adminPrisma } from "@/lib/db/admin-client";
import { getLlmAdapter } from "@/lib/integrations/llm";
import type { CompleteInput } from "@/lib/integrations/llm";
import { hasOrgFeature } from "@/lib/features/subscription.service";
import { minimizeJsonPayload, minimizeTextForLlm } from "../lib/minimize-payload";
import { requireAiConsent, isAiResourceEnabled } from "../lib/consent";
import { assertWithinUsageLimit, recordAiUsage } from "../lib/usage";

export type AiCallOptions = {
  organizationId: string;
  userId?: string | null;
  resource: AiResourceType;
  system: string;
  userMessage: string;
  context?: unknown;
  temperature?: number;
  skipConsent?: boolean;
  skipMinimize?: boolean;
};

export async function assertAiFeature(organizationId: string) {
  const ok = await hasOrgFeature(organizationId, "ai");
  if (!ok) throw new Error("Recursos de IA disponíveis no plano ENTERPRISE");
}

export async function aiComplete(options: AiCallOptions): Promise<{
  text: string;
  logId: string;
  tokensUsed: number;
}> {
  await assertAiFeature(options.organizationId);
  await assertWithinUsageLimit(options.organizationId);

  const enabled = await isAiResourceEnabled(options.organizationId, options.resource);
  if (!enabled) throw new Error("Recurso de IA desabilitado nas configurações");

  if (!options.skipConsent) {
    await requireAiConsent(options.organizationId, options.resource);
  }

  const minimizedContext = options.skipMinimize
    ? options.context
    : minimizeJsonPayload(options.context ?? {});
  const userContent =
    minimizedContext && Object.keys(minimizedContext as object).length > 0
      ? `${minimizeTextForLlm(options.userMessage)}\n\nContexto:\n${JSON.stringify(minimizedContext)}`
      : minimizeTextForLlm(options.userMessage);

  const input: CompleteInput = {
    system: options.system,
    messages: [{ role: "user", content: userContent }],
    temperature: options.temperature,
  };

  const start = Date.now();
  const llm = getLlmAdapter();
  const result = await llm.complete(input);
  const latencyMs = Date.now() - start;

  await recordAiUsage(options.organizationId, result.tokensUsed);

  const log = await adminPrisma.aiInteractionLog.create({
    data: {
      organizationId: options.organizationId,
      userId: options.userId ?? null,
      resource: options.resource,
      tokensUsed: result.tokensUsed,
      latencyMs,
      outcome: "PENDING",
      payloadEncrypted: encryptPHI(
        JSON.stringify({
          system: options.system.slice(0, 200),
          tokensUsed: result.tokensUsed,
          model: result.model,
        }),
      ),
    },
  });

  return { text: result.text, logId: log.id, tokensUsed: result.tokensUsed };
}

export async function updateAiInteractionOutcome(
  logId: string,
  organizationId: string,
  outcome: AiInteractionOutcome,
) {
  return adminPrisma.aiInteractionLog.updateMany({
    where: { id: logId, organizationId },
    data: { outcome },
  });
}

export async function aiTranscribe(
  organizationId: string,
  userId: string,
  audioBase64: string,
): Promise<{ text: string; logId: string }> {
  await assertAiFeature(organizationId);
  await requireAiConsent(organizationId, "CLINICAL_COPILOT");
  await assertWithinUsageLimit(organizationId);

  const start = Date.now();
  const result = await getLlmAdapter().transcribe({ audioBase64, language: "pt-BR" });
  await recordAiUsage(organizationId, result.tokensUsed);

  const log = await adminPrisma.aiInteractionLog.create({
    data: {
      organizationId,
      userId,
      resource: "CLINICAL_COPILOT",
      tokensUsed: result.tokensUsed,
      latencyMs: Date.now() - start,
      outcome: "PENDING",
      payloadEncrypted: encryptPHI(JSON.stringify({ action: "transcribe" })),
    },
  });

  return { text: result.text, logId: log.id };
}
