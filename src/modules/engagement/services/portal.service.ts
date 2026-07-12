import { adminPrisma } from "@/lib/db/admin-client";
import { logRecordAccess } from "@/modules/emr/services/record-access.service";
import type { PortalSessionContext } from "../lib/portal-session";

export async function logPortalAccess(
  session: PortalSessionContext,
  resourceType: "PATIENT_PORTAL",
  resourceId: string,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  await logRecordAccess({
    organizationId: session.organizationId,
    userId: null,
    resourceType,
    resourceId,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    metadata: { patientId: session.patientId, portalSessionId: session.sessionId },
  });
}

export async function getPortalDashboard(session: PortalSessionContext) {
  const now = new Date();
  const [upcoming, history, documents, receivables, fiscalDocuments, paymentLinks, org] = await Promise.all([
    adminPrisma.appointment.findMany({
      where: {
        organizationId: session.organizationId,
        patientId: session.patientId,
        startsAt: { gte: now },
        status: { in: ["AGENDADO", "CONFIRMADO", "AGUARDANDO"] },
      },
      orderBy: { startsAt: "asc" },
      include: {
        professional: { select: { displayName: true } },
        service: { select: { name: true, isTeleconsult: true } },
      },
    }),
    adminPrisma.encounter.findMany({
      where: {
        organizationId: session.organizationId,
        patientId: session.patientId,
        status: "ASSINADO",
      },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        id: true,
        startedAt: true,
        specialty: true,
        modality: true,
        appointment: { select: { service: { select: { name: true } } } },
      },
    }),
    adminPrisma.releasedDocument.findMany({
      where: {
        organizationId: session.organizationId,
        patientId: session.patientId,
        revokedAt: null,
      },
      orderBy: { releasedAt: "desc" },
    }),
    adminPrisma.receivable.findMany({
      where: {
        organizationId: session.organizationId,
        patientId: session.patientId,
        status: "ABERTO",
      },
      orderBy: { dueDate: "asc" },
      select: {
        id: true,
        description: true,
        totalCents: true,
        paidCents: true,
        dueDate: true,
      },
    }),
    adminPrisma.fiscalDocument.findMany({
      where: {
        organizationId: session.organizationId,
        patientId: session.patientId,
        status: "ISSUED",
        pdfStorageKey: { not: null },
      },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        documentType: true,
        number: true,
        amountCents: true,
        issuedAt: true,
        serviceDescription: true,
      },
    }),
    adminPrisma.patientPaymentLink.findMany({
      where: {
        organizationId: session.organizationId,
        patientId: session.patientId,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, receivableId: true, amountCents: true },
    }),
    adminPrisma.organization.findFirstOrThrow({
      where: { id: session.organizationId },
      select: { name: true, slug: true },
    }),
  ]);

  return { upcoming, history, documents, receivables, fiscalDocuments, paymentLinks, org };
}

export async function requestPatientDataCorrection(
  session: PortalSessionContext,
  fields: Record<string, string>,
  message?: string,
) {
  return adminPrisma.patientDataCorrectionRequest.create({
    data: {
      organizationId: session.organizationId,
      patientId: session.patientId,
      requestedFields: fields,
      message: message ?? null,
    },
  });
}

export async function cancelPortalAppointment(
  session: PortalSessionContext,
  appointmentId: string,
) {
  const appt = await adminPrisma.appointment.findFirst({
    where: {
      id: appointmentId,
      organizationId: session.organizationId,
      patientId: session.patientId,
    },
  });
  if (!appt) throw new Error("Consulta não encontrada");
  const hoursUntil =
    (appt.startsAt.getTime() - Date.now()) / (60 * 60 * 1000);
  if (hoursUntil < 24) {
    throw new Error("Cancelamento permitido apenas com 24h de antecedência");
  }
  return adminPrisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: "CANCELADO",
      cancelReason: "Cancelado pelo paciente no portal",
    },
  });
}
