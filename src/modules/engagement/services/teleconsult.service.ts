import { z } from "zod";
import { adminPrisma } from "@/lib/db/admin-client";
import { getVideoAdapter } from "@/lib/integrations/video";
import { createAuditLog } from "@/modules/core/services/audit.service";
import { generatePublicToken } from "../lib/public-security";

const CONSENT_TERM_VERSION = "CFM-2314-2022-v1";
const CONSENT_TTL_DAYS = 7;

export const teleconsultVideoIncidentSchema = z.object({
  encounterId: z.string().min(1),
  kind: z.enum([
    "audio_issue",
    "video_issue",
    "connection_lost",
    "other",
  ]),
  notes: z.string().max(2000).optional(),
});

export type TeleconsultVideoCredentials = {
  provider: string;
  url: string;
  roomName: string;
  token?: string;
};

export async function createTeleconsultConsentForAppointment(
  organizationId: string,
  appointmentId: string,
  patientId: string,
) {
  const existing = await adminPrisma.teleconsultConsent.findUnique({
    where: { appointmentId },
  });
  if (existing) return existing;

  return adminPrisma.teleconsultConsent.create({
    data: {
      organizationId,
      patientId,
      appointmentId,
      termVersion: CONSENT_TERM_VERSION,
      token: generatePublicToken(),
      expiresAt: new Date(Date.now() + CONSENT_TTL_DAYS * 86400_000),
    },
  });
}

export async function acceptTeleconsultConsent(input: {
  token: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const consent = await adminPrisma.teleconsultConsent.findUnique({
    where: { token: input.token },
  });
  if (!consent || consent.expiresAt < new Date()) {
    throw new Error("Termo inválido ou expirado");
  }
  if (consent.acceptedAt) return consent;

  return adminPrisma.teleconsultConsent.update({
    where: { id: consent.id },
    data: {
      acceptedAt: new Date(),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function createTeleconsultRoom(
  organizationId: string,
  encounterId: string,
) {
  const existing = await adminPrisma.teleconsultRoom.findUnique({
    where: { encounterId },
  });
  if (existing) return existing;

  const encounter = await adminPrisma.encounter.findFirstOrThrow({
    where: { id: encounterId, organizationId },
    include: {
      appointment: { include: { service: true } },
      professional: { select: { displayName: true } },
    },
  });

  if (encounter.appointment?.service.isTeleconsult) {
    const consent = await adminPrisma.teleconsultConsent.findUnique({
      where: { appointmentId: encounter.appointmentId! },
    });
    if (!consent?.acceptedAt) {
      throw new Error("Consentimento de teleconsulta não aceito");
    }
    await adminPrisma.encounter.update({
      where: { id: encounterId },
      data: {
        modality: "TELECONSULTA",
        teleconsultConsentId: consent.id,
      },
    });
  }

  const video = getVideoAdapter();
  const room = await video.createRoom({
    organizationId,
    encounterId,
    expiresInMinutes: 120,
    scheduledAt: encounter.appointment?.startsAt ?? undefined,
    durationMinutes: encounter.appointment?.service.durationMinutes ?? 30,
  });

  const teleconsultRoom = await adminPrisma.teleconsultRoom.create({
    data: {
      organizationId,
      encounterId,
      provider: room.provider,
      roomUrl: room.url,
      roomName: room.roomName,
      expiresAt: room.expiresAt,
    },
  });

  await createAuditLog({
    action: "teleconsult.room_created",
    organizationId,
    entityType: "Encounter",
    entityId: encounterId,
    metadata: {
      provider: room.provider,
      roomName: room.roomName,
    },
  });

  return teleconsultRoom;
}

export async function getTeleconsultVideoCredentials(
  organizationId: string,
  encounterId: string,
  role: "professional" | "patient",
  displayName: string,
): Promise<TeleconsultVideoCredentials> {
  const room = await adminPrisma.teleconsultRoom.findUnique({
    where: { encounterId },
  });
  if (!room || room.organizationId !== organizationId) {
    throw new Error("Sala de teleconsulta não encontrada");
  }

  if (room.expiresAt < new Date()) {
    throw new Error("Sala de teleconsulta expirada");
  }

  const video = getVideoAdapter();
  if (video.isRoomJoinable) {
    const joinable = await video.isRoomJoinable(room.roomName);
    if (!joinable) {
      throw new Error("Sala de vídeo indisponível — recrie a sala");
    }
  }

  let token: string | undefined;
  if (video.createMeetingToken) {
    token = await video.createMeetingToken({
      roomName: room.roomName,
      userName: displayName,
      isOwner: role === "professional",
      expiresAtUnix: Math.floor(room.expiresAt.getTime() / 1000),
    });
  }

  await markTeleconsultJoin(encounterId, role);

  return {
    provider: room.provider,
    url: room.roomUrl,
    roomName: room.roomName,
    token,
  };
}

export async function reportTeleconsultVideoIncident(
  organizationId: string,
  userId: string | null,
  input: z.infer<typeof teleconsultVideoIncidentSchema>,
) {
  const encounter = await adminPrisma.encounter.findFirstOrThrow({
    where: { id: input.encounterId, organizationId },
    select: { patientId: true },
  });

  const incident = await adminPrisma.teleconsultVideoIncident.create({
    data: {
      organizationId,
      encounterId: input.encounterId,
      patientId: encounter.patientId,
      reportedByUserId: userId,
      kind: input.kind,
      notes: input.notes ?? null,
    },
  });

  await createAuditLog({
    action: "teleconsult.video_incident",
    organizationId,
    userId,
    entityType: "Encounter",
    entityId: input.encounterId,
    metadata: { kind: input.kind },
  });

  return incident;
}

export async function markTeleconsultJoin(
  encounterId: string,
  role: "professional" | "patient",
) {
  const now = new Date();
  const roomField =
    role === "professional" ? "professionalJoinedAt" : "patientJoinedAt";
  const encounterField =
    role === "professional" ? "professionalJoinedAt" : "patientJoinedAt";

  await adminPrisma.teleconsultRoom.updateMany({
    where: { encounterId },
    data: { [roomField]: now },
  });

  await adminPrisma.encounter.updateMany({
    where: { id: encounterId },
    data: { [encounterField]: now },
  });
}

export function getConsentTermText(): string {
  return `TERMO DE CONSENTIMENTO PARA TELECONSULTA (Resolução CFM nº 2.314/2022)

Declaro estar ciente de que o atendimento será realizado por meio de tecnologia de comunicação à distância, com limitações inerentes ao formato remoto. Autorizo a realização da teleconsulta e o registro das informações clínicas necessárias no prontuário eletrônico.

Versão do termo: ${CONSENT_TERM_VERSION}`;
}
