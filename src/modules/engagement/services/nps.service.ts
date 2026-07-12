import { adminPrisma } from "@/lib/db/admin-client";
import { generatePublicToken } from "../lib/public-security";

export async function createNpsSurvey(input: {
  organizationId: string;
  patientId: string;
  appointmentId?: string;
  encounterId?: string;
}) {
  const token = generatePublicToken();
  const expiresAt = new Date(Date.now() + 7 * 86400_000);
  return adminPrisma.npsSurvey.create({
    data: {
      organizationId: input.organizationId,
      patientId: input.patientId,
      appointmentId: input.appointmentId ?? null,
      encounterId: input.encounterId ?? null,
      token,
      expiresAt,
    },
  });
}

export async function createNpsSurveyForEncounter(
  organizationId: string,
  encounterId: string,
) {
  const encounter = await adminPrisma.encounter.findFirst({
    where: { id: encounterId, organizationId },
  });
  if (!encounter) return null;
  const existing = await adminPrisma.npsSurvey.findFirst({
    where: { encounterId },
  });
  if (existing) return existing;
  return createNpsSurvey({
    organizationId,
    patientId: encounter.patientId,
    appointmentId: encounter.appointmentId ?? undefined,
    encounterId,
  });
}

export async function submitNpsResponse(input: {
  token: string;
  score: number;
  comment?: string;
}) {
  if (input.score < 0 || input.score > 10) {
    throw new Error("Nota deve ser entre 0 e 10");
  }
  const survey = await adminPrisma.npsSurvey.findUnique({
    where: { token: input.token },
    include: { response: true },
  });
  if (!survey || survey.expiresAt < new Date()) {
    throw new Error("Pesquisa inválida ou expirada");
  }
  if (survey.response) throw new Error("Pesquisa já respondida");

  const response = await adminPrisma.npsResponse.create({
    data: {
      organizationId: survey.organizationId,
      surveyId: survey.id,
      score: input.score,
      comment: input.comment ?? null,
    },
  });

  if (input.score <= 6) {
    await adminPrisma.auditLog.create({
      data: {
        organizationId: survey.organizationId,
        action: "nps.detractor",
        entityType: "NpsResponse",
        entityId: response.id,
        metadata: { score: input.score, surveyId: survey.id },
      },
    });
  } else if (input.score >= 9) {
    const { handleNpsReputation } = await import(
      "@/modules/marketing/services/reputation.service"
    );
    await handleNpsReputation(survey.organizationId, survey.patientId, input.score);
  }

  return response;
}

export async function getNpsReport(organizationId: string, months = 6) {
  const from = new Date();
  from.setMonth(from.getMonth() - months);

  const responses = await adminPrisma.npsResponse.findMany({
    where: {
      organizationId,
      respondedAt: { gte: from },
    },
    include: {
      survey: {
        include: {
          appointment: {
            include: { professional: { select: { displayName: true, id: true } } },
          },
        },
      },
    },
  });

  const promoters = responses.filter((r) => r.score >= 9).length;
  const detractors = responses.filter((r) => r.score <= 6).length;
  const total = responses.length;
  const nps = total ? Math.round(((promoters - detractors) / total) * 100) : 0;

  const byProfessional = new Map<
    string,
    { name: string; scores: number[] }
  >();
  for (const r of responses) {
    const prof = r.survey.appointment?.professional;
    if (!prof) continue;
    const cur = byProfessional.get(prof.id) ?? { name: prof.displayName, scores: [] };
    cur.scores.push(r.score);
    byProfessional.set(prof.id, cur);
  }

  const monthly = new Map<string, number[]>();
  for (const r of responses) {
    const key = r.respondedAt.toISOString().slice(0, 7);
    const arr = monthly.get(key) ?? [];
    arr.push(r.score);
    monthly.set(key, arr);
  }

  return {
    nps,
    total,
    promoters,
    detractors,
    comments: responses.filter((r) => r.comment).map((r) => ({
      score: r.score,
      comment: r.comment!,
      at: r.respondedAt,
    })),
    byProfessional: Array.from(byProfessional.values()).map((p) => ({
      name: p.name,
      avg: p.scores.reduce((a, b) => a + b, 0) / p.scores.length,
      count: p.scores.length,
    })),
    monthly: Array.from(monthly.entries()).map(([month, scores]) => ({
      month,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      count: scores.length,
    })),
  };
}
