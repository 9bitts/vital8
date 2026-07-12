import { adminPrisma } from "@/lib/db/admin-client";
import { getVideoAdapter } from "@/lib/integrations/video";
import { generatePublicToken } from "../lib/public-security";

const CONSENT_TERM_VERSION = "CFM-2314-2022-v1";
const CONSENT_TTL_DAYS = 7;

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
    include: { appointment: { include: { service: true } } },
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
  });

  return adminPrisma.teleconsultRoom.create({
    data: {
      organizationId,
      encounterId,
      provider: room.provider,
      roomUrl: room.url,
      roomName: room.roomName,
      expiresAt: room.expiresAt,
    },
  });
}

export async function markTeleconsultJoin(
  encounterId: string,
  role: "professional" | "patient",
) {
  const field =
    role === "professional" ? "professionalJoinedAt" : "patientJoinedAt";
  return adminPrisma.teleconsultRoom.updateMany({
    where: { encounterId },
    data: { [field]: new Date() },
  });
}

export function getConsentTermText(): string {
  return `TERMO DE CONSENTIMENTO PARA TELECONSULTA (Resolução CFM nº 2.314/2022)

Declaro estar ciente de que o atendimento será realizado por meio de tecnologia de comunicação à distância, com limitações inerentes ao formato remoto. Autorizo a realização da teleconsulta e o registro das informações clínicas necessárias no prontuário eletrônico.

Versão do termo: ${CONSENT_TERM_VERSION}`;
}
