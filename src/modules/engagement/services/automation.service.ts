import type {
  AutomationOffsetUnit,
  AutomationTriggerEvent,
  CommunicationChannel,
  CommunicationOrigin,
} from "@/generated/prisma/client";
import { randomBytes } from "crypto";
import { adminPrisma } from "@/lib/db/admin-client";
import { formatInSaoPaulo, computeOffsetTime } from "../lib/timezone";
import { renderMessageTemplate } from "../lib/template-renderer";
import { createNpsSurvey } from "./nps.service";

const ORIGIN_BY_EVENT: Record<AutomationTriggerEvent, CommunicationOrigin> = {
  APPOINTMENT_CONFIRMATION: "CONFIRMACAO",
  RETURN_REMINDER: "LEMBRETE_RETORNO",
  BIRTHDAY: "ANIVERSARIO",
  POST_ENCOUNTER_NPS: "NPS",
  OVERDUE_COLLECTION: "COBRANCA",
  LEAD_NEW: "LEAD_FOLLOWUP",
  LEAD_NO_RESPONSE: "LEAD_FOLLOWUP",
  LEAD_NO_SHOW: "LEAD_FOLLOWUP",
};

export async function enqueueCommunication(input: {
  organizationId: string;
  patientId: string;
  channel: CommunicationChannel;
  templateId: string;
  body: string;
  subject?: string | null;
  origin: CommunicationOrigin;
  originRefId?: string;
  scheduledFor?: Date;
  idempotencyKey: string;
  campaignId?: string;
}) {
  try {
    return await adminPrisma.communicationLog.create({
      data: {
        organizationId: input.organizationId,
        patientId: input.patientId,
        channel: input.channel,
        templateId: input.templateId,
        subject: input.subject ?? null,
        renderedBody: input.body,
        origin: input.origin,
        originRefId: input.originRefId ?? null,
        scheduledFor: input.scheduledFor ?? null,
        idempotencyKey: input.idempotencyKey,
        campaignId: input.campaignId ?? null,
        status: "FILA",
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return null;
    }
    throw e;
  }
}

export async function scheduleAppointmentConfirmations(
  organizationId: string,
  appointmentId: string,
) {
  const appointment = await adminPrisma.appointment.findFirst({
    where: { id: appointmentId, organizationId },
    include: {
      patient: true,
      professional: true,
      service: true,
      organization: true,
    },
  });
  if (!appointment) return [];

  const rules = await adminPrisma.automationRule.findMany({
    where: {
      organizationId,
      triggerEvent: "APPOINTMENT_CONFIRMATION",
      isActive: true,
    },
    include: { template: true },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const created = [];

  for (const rule of rules) {
    const scheduledFor = computeOffsetTime(
      appointment.startsAt,
      rule.offsetValue,
      rule.offsetUnit as AutomationOffsetUnit,
    );
    const token = randomBytes(24).toString("hex");
    await adminPrisma.appointmentConfirmation.create({
      data: {
        organizationId,
        appointmentId,
        channel: rule.channel === "EMAIL" ? "EMAIL" : rule.channel === "SMS" ? "SMS" : "WHATSAPP",
        token,
        status: "PENDENTE",
      },
    });
    const idempotencyKey = `confirm:${appointmentId}:${rule.id}`;
    const body = renderMessageTemplate(rule.template.body, {
      paciente: appointment.patient.fullName,
      data: formatInSaoPaulo(appointment.startsAt, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      hora: formatInSaoPaulo(appointment.startsAt, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      profissional: appointment.professional.displayName,
      clinica: appointment.organization.name,
      servico: appointment.service.name,
      link: `${baseUrl}/confirmar/${token}`,
    });
    const log = await enqueueCommunication({
      organizationId,
      patientId: appointment.patientId,
      channel: rule.channel,
      templateId: rule.templateId,
      subject: rule.template.subject,
      body,
      origin: ORIGIN_BY_EVENT[rule.triggerEvent],
      originRefId: appointmentId,
      scheduledFor,
      idempotencyKey,
    });
    if (log) created.push(log);
  }
  return created;
}

export async function schedulePostEncounterNps(
  organizationId: string,
  encounterId: string,
) {
  const encounter = await adminPrisma.encounter.findFirst({
    where: { id: encounterId, organizationId },
    include: {
      patient: true,
      professional: true,
      organization: true,
      appointment: { include: { service: true } },
    },
  });
  if (!encounter) return null;

  const rules = await adminPrisma.automationRule.findMany({
    where: {
      organizationId,
      triggerEvent: "POST_ENCOUNTER_NPS",
      isActive: true,
    },
    include: { template: true },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  for (const rule of rules) {
    const scheduledFor = computeOffsetTime(
      encounter.endedAt ?? encounter.startedAt,
      rule.offsetValue,
      rule.offsetUnit as AutomationOffsetUnit,
    );
    const survey = await createNpsSurvey({
      organizationId,
      patientId: encounter.patientId,
      appointmentId: encounter.appointmentId ?? undefined,
      encounterId,
    });
    const idempotencyKey = `nps:${encounterId}:${rule.id}`;
    const body = renderMessageTemplate(rule.template.body, {
      paciente: encounter.patient.fullName,
      profissional: encounter.professional.displayName,
      clinica: encounter.organization.name,
      servico: encounter.appointment?.service.name ?? "Consulta",
      link: `${baseUrl}/nps/${survey.token}`,
    });
    await enqueueCommunication({
      organizationId,
      patientId: encounter.patientId,
      channel: rule.channel,
      templateId: rule.templateId,
      subject: rule.template.subject,
      body,
      origin: "NPS",
      originRefId: encounterId,
      scheduledFor,
      idempotencyKey,
    });
  }
}

export async function scanBirthdayAutomations(organizationId: string) {
  const today = new Date();
  const rules = await adminPrisma.automationRule.findMany({
    where: { organizationId, triggerEvent: "BIRTHDAY", isActive: true },
    include: { template: true },
  });
  if (rules.length === 0) return [];

  const patients = await adminPrisma.patient.findMany({
    where: {
      organizationId,
      isActive: true,
      birthDate: { not: null },
    },
  });

  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const created = [];

  for (const patient of patients) {
    if (!patient.birthDate) continue;
    const bd = patient.birthDate;
    if (bd.getUTCMonth() + 1 !== month || bd.getUTCDate() !== day) continue;

    for (const rule of rules) {
      const idempotencyKey = `birthday:${patient.id}:${today.toISOString().slice(0, 10)}:${rule.id}`;
      const org = await adminPrisma.organization.findFirstOrThrow({
        where: { id: organizationId },
      });
      const body = renderMessageTemplate(rule.template.body, {
        paciente: patient.fullName,
        clinica: org.name,
      });
      const log = await enqueueCommunication({
        organizationId,
        patientId: patient.id,
        channel: rule.channel,
        templateId: rule.templateId,
        subject: rule.template.subject,
        body,
        origin: "ANIVERSARIO",
        originRefId: patient.id,
        scheduledFor: new Date(),
        idempotencyKey,
      });
      if (log) created.push(log);
    }
  }
  return created;
}

export async function scanOverdueCollections(organizationId: string) {
  const rules = await adminPrisma.automationRule.findMany({
    where: { organizationId, triggerEvent: "OVERDUE_COLLECTION", isActive: true },
    include: { template: true },
  });
  if (rules.length === 0) return [];

  const overdue = await adminPrisma.receivable.findMany({
    where: {
      organizationId,
      status: "ABERTO",
      dueDate: { lt: new Date() },
      optOutReminders: false,
    },
    include: { patient: true },
  });

  const created = [];
  for (const recv of overdue) {
    if (!recv.patient) continue;
    const org = await adminPrisma.organization.findFirst({
      where: { id: organizationId },
    });
    for (const rule of rules) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const idempotencyKey = `overdue:${recv.id}:${rule.id}`;
      const body = renderMessageTemplate(rule.template.body, {
        paciente: recv.patient.fullName,
        clinica: org?.name ?? "",
        link: `${baseUrl}/pagamento/${recv.id}`,
      });
      const log = await enqueueCommunication({
        organizationId,
        patientId: recv.patientId,
        channel: rule.channel,
        templateId: rule.templateId,
        subject: rule.template.subject,
        body,
        origin: "COBRANCA",
        originRefId: recv.id,
        scheduledFor: new Date(),
        idempotencyKey,
      });
      if (log) created.push(log);
    }
  }
  return created;
}

export async function runAutomationScanners(organizationId: string) {
  await scanBirthdayAutomations(organizationId);
  await scanOverdueCollections(organizationId);
}
