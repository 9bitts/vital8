import type { TenantClient } from "@/lib/db/tenant-client";
import { encryptPHI } from "@/lib/crypto/phi";
import { adminPrisma } from "@/lib/db/admin-client";
import {
  aiTranscribe,
  structureSoapFromText,
  updateAiInteractionOutcome,
} from "./clinical-copilot.service";

export const SCRIBE_CONSENT_TERM = "ai-scribe-audio";
export const SCRIBE_TERM_VERSION = "2026-07";

export async function hasScribeConsent(
  db: TenantClient,
  patientId: string,
  organizationId: string,
): Promise<boolean> {
  const consent = await db.patientConsent.findFirst({
    where: {
      patientId,
      organizationId,
      termKey: SCRIBE_CONSENT_TERM,
      revokedAt: null,
      deletedAt: null,
    },
  });
  return Boolean(consent);
}

export async function recordScribeConsent(
  db: TenantClient,
  organizationId: string,
  patientId: string,
  encounterId: string,
  userId: string,
) {
  await db.patientConsent.create({
    data: {
      organizationId,
      patientId,
      termKey: SCRIBE_CONSENT_TERM,
      termVersion: SCRIBE_TERM_VERSION,
      purpose: "Gravação de áudio da consulta para transcrição assistida por IA",
      channel: "PRESENCIAL",
      recordedById: userId,
    },
  });

  const session = await db.scribeSession.create({
    data: {
      organizationId,
      encounterId,
      patientId,
      userId,
      consentRecordedAt: new Date(),
      status: "CONSENTED",
    },
  });

  return session;
}

export async function processScribeAudio(
  db: TenantClient,
  organizationId: string,
  userId: string,
  sessionId: string,
  audioBase64: string,
) {
  const session = await db.scribeSession.findFirstOrThrow({
    where: { id: sessionId, organizationId },
  });

  if (session.status !== "CONSENTED" && session.status !== "STARTED") {
    throw new Error("Sessão de scribe inválida");
  }

  const settings = await adminPrisma.aiSettings.findUnique({
    where: { organizationId },
  });
  const discardAudio = settings?.discardAudioAfterTranscription ?? true;
  void discardAudio;

  const { text, logId: transcribeLogId } = await aiTranscribe(
    organizationId,
    userId,
    audioBase64,
  );

  const soapResult = await structureSoapFromText(organizationId, userId, text);
  let soapDraft: Record<string, string> = {};
  try {
    soapDraft = JSON.parse(soapResult.text) as Record<string, string>;
  } catch {
    soapDraft = { subjective: soapResult.text };
  }

  const updated = await db.scribeSession.update({
    where: { id: sessionId },
    data: {
      transcriptEncrypted: encryptPHI(text),
      soapDraft,
      transcribeLogId,
      soapLogId: soapResult.logId,
      status: "SOAP_READY",
    },
  });

  return {
    session: updated,
    transcript: text,
    soap: soapDraft,
    transcribeLogId,
    soapLogId: soapResult.logId,
  };
}

export async function markScribeApplied(
  db: TenantClient,
  organizationId: string,
  sessionId: string,
  soapLogId?: string,
) {
  await db.scribeSession.updateMany({
    where: { id: sessionId, organizationId },
    data: { status: "APPLIED" },
  });
  if (soapLogId) {
    await updateAiInteractionOutcome(soapLogId, organizationId, "ACCEPTED");
  }
}

export async function getActiveScribeSession(
  db: TenantClient,
  organizationId: string,
  encounterId: string,
) {
  return db.scribeSession.findFirst({
    where: {
      organizationId,
      encounterId,
      status: { in: ["CONSENTED", "TRANSCRIBED", "SOAP_READY"] },
    },
    orderBy: { createdAt: "desc" },
  });
}
