import type { TenantClient } from "@/lib/db/tenant-client";
import { decryptPHI } from "@/lib/crypto/phi";
import { aiComplete, aiTranscribe, updateAiInteractionOutcome } from "./llm-gateway.service";

export async function summarizePatientHistory(
  organizationId: string,
  userId: string,
  db: TenantClient,
  patientId: string,
) {
  const encounters = await db.encounter.findMany({
    where: { patientId, status: "ASSINADO" },
    orderBy: { signedAt: "desc" },
    take: 10,
    include: { sections: true },
  });

  const allergies = await db.allergy.findMany({ where: { patientId, deletedAt: null } });
  const conditions = await db.chronicCondition.findMany({ where: { patientId, deletedAt: null } });

  const context = {
    encounterCount: encounters.length,
    sections: encounters.flatMap((e) =>
      e.sections.map((s) => ({
        type: s.sectionType,
        excerpt: s.contentEncrypted ? decryptPHI(s.contentEncrypted).slice(0, 200) : null,
      })),
    ),
    allergies: allergies.map((a) => a.substance),
    conditions: conditions.map((c) => c.condition),
  };

  return aiComplete({
    organizationId,
    userId,
    resource: "CLINICAL_COPILOT",
    system: "RESUMO: gere síntese clínica objetiva. Marque como sugestão IA.",
    userMessage: "Resumir histórico do paciente",
    context,
  });
}

export async function structureSoapFromText(
  organizationId: string,
  userId: string,
  freeText: string,
) {
  return aiComplete({
    organizationId,
    userId,
    resource: "CLINICAL_COPILOT",
    system: "SOAP: estruture em JSON {subjective, objective, assessment, plan}",
    userMessage: freeText,
  });
}

export async function suggestCid10Codes(
  organizationId: string,
  userId: string,
  hypothesis: string,
  db: TenantClient,
) {
  const local = await db.cid10Code.findMany({
    where: {
      OR: [
        { description: { contains: hypothesis.slice(0, 20), mode: "insensitive" } },
        { code: { startsWith: hypothesis.slice(0, 3) } },
      ],
    },
    take: 5,
  });

  const { text, logId, tokensUsed } = await aiComplete({
    organizationId,
    userId,
    resource: "CLINICAL_COPILOT",
    system: "CID: sugira códigos CID-10 em JSON array [{code, label}]",
    userMessage: hypothesis,
    context: { localMatches: local.map((c) => ({ code: c.code, label: c.description })) },
  });

  let suggestions: { code: string; label: string }[] = [];
  try {
    suggestions = JSON.parse(text) as { code: string; label: string }[];
  } catch {
    suggestions = local.map((c) => ({ code: c.code, label: c.description }));
  }

  return { suggestions, logId, tokensUsed };
}

export async function suggestCidFromAnamnesis(
  organizationId: string,
  userId: string,
  anamnesisText: string,
  db: TenantClient,
) {
  return suggestCid10Codes(organizationId, userId, anamnesisText, db);
}

export async function draftClinicalDocument(
  organizationId: string,
  userId: string,
  type: "certificate" | "referral" | "orientation",
  encounterContext: Record<string, unknown>,
) {
  return aiComplete({
    organizationId,
    userId,
    resource: "CLINICAL_COPILOT",
    system: `Rascunho de ${type} — texto editável, nunca definitivo`,
    userMessage: "Gerar rascunho",
    context: encounterContext,
  });
}

export { aiTranscribe, updateAiInteractionOutcome };

