import { adminPrisma } from "@/lib/db/admin-client";
import { hasFeature } from "@/lib/features/features.service";
import { generateAvailableSlots } from "@/modules/scheduling/services/slot.service";
import { isOccupyingStatus } from "@/modules/scheduling/services/conflict.service";
import { validateAppointmentSlot } from "@/modules/scheduling/services/appointment.service";
import { createTenantClient } from "@/lib/db/tenant-client";
import { scheduleAppointmentConfirmations } from "./automation.service";
import { createTeleconsultConsentForAppointment } from "./teleconsult.service";

export async function getOnlineBookingContext(orgSlug: string) {
  const org = await adminPrisma.organization.findFirst({
    where: { slug: orgSlug, isActive: true, deletedAt: null },
    include: { onlineBookingConfig: true },
  });
  if (!org || !hasFeature(org.plan, "online_scheduling")) {
    return null;
  }
  const config = org.onlineBookingConfig;
  if (!config?.isEnabled) return null;
  return { org, config };
}

export async function listBookableServices(organizationId: string, config: {
  enabledServiceIds: string[];
}) {
  const where = {
    organizationId,
    isActive: true,
    allowOnlineBooking: true,
    ...(config.enabledServiceIds.length
      ? { id: { in: config.enabledServiceIds } }
      : {}),
  };
  return adminPrisma.service.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      isTeleconsult: true,
      privatePrice: true,
    },
  });
}

export async function listBookableProfessionals(
  organizationId: string,
  serviceId: string,
  config: { enabledProfessionalIds: string[] },
) {
  const templates = await adminPrisma.scheduleTemplate.findMany({
    where: {
      organizationId,
      ...(config.enabledProfessionalIds.length
        ? { professionalId: { in: config.enabledProfessionalIds } }
        : {}),
    },
    distinct: ["professionalId"],
    select: { professionalId: true },
  });
  const ids = templates.map((t) => t.professionalId);
  return adminPrisma.professional.findMany({
    where: { organizationId, isActive: true, id: { in: ids } },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true, specialties: true },
  });
}

export async function getPublicAvailableSlots(input: {
  organizationId: string;
  professionalId: string;
  serviceId: string;
  date: Date;
  config: { minAdvanceHours: number; maxAdvanceDays: number };
}) {
  const now = new Date();
  const minStart = new Date(now.getTime() + input.config.minAdvanceHours * 3600_000);
  const maxStart = new Date(now.getTime() + input.config.maxAdvanceDays * 86400_000);

  const [templates, service, exceptions, holidays, occupied] = await Promise.all([
    adminPrisma.scheduleTemplate.findMany({
      where: { organizationId: input.organizationId, professionalId: input.professionalId },
    }),
    adminPrisma.service.findFirstOrThrow({ where: { id: input.serviceId } }),
    adminPrisma.scheduleException.findMany({
      where: {
        organizationId: input.organizationId,
        professionalId: input.professionalId,
        startAt: { lt: new Date(input.date.getTime() + 86400000) },
        endAt: { gt: input.date },
      },
    }),
    adminPrisma.holiday.findMany({ where: { organizationId: input.organizationId } }),
    adminPrisma.appointment.findMany({
      where: {
        organizationId: input.organizationId,
        professionalId: input.professionalId,
        startsAt: { lt: new Date(input.date.getTime() + 86400000) },
        endsAt: { gt: input.date },
      },
      select: { startsAt: true, endsAt: true, status: true },
    }),
  ]);

  const slots = generateAvailableSlots({
    date: input.date,
    templates,
    durationMinutes: service.durationMinutes,
    exceptions: exceptions.map((e) => ({ startsAt: e.startAt, endsAt: e.endAt })),
    holidays: holidays.map((h) => h.date),
    occupied: occupied
      .filter((a) => isOccupyingStatus(a.status))
      .map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
  });

  return slots.filter(
    (s) => s.startsAt >= minStart && s.startsAt <= maxStart,
  );
}

export async function createOnlineAppointment(input: {
  organizationId: string;
  patientId: string;
  professionalId: string;
  serviceId: string;
  startsAt: Date;
  requiresApproval: boolean;
}) {
  const db = createTenantClient(input.organizationId);
  const service = await db.service.findFirstOrThrow({
    where: { id: input.serviceId },
  });

  const { endsAt } = await validateAppointmentSlot(
    db,
    {
      patientId: input.patientId,
      professionalId: input.professionalId,
      serviceId: input.serviceId,
      startsAt: input.startsAt,
      origin: "ONLINE",
    },
    service.durationMinutes,
  );

  const appointment = await db.appointment.create({
    data: {
      organizationId: input.organizationId,
      patientId: input.patientId,
      professionalId: input.professionalId,
      serviceId: input.serviceId,
      startsAt: input.startsAt,
      endsAt,
      origin: "ONLINE",
      status: input.requiresApproval ? "AGENDADO" : "CONFIRMADO",
      onlineApprovalStatus: input.requiresApproval ? "PENDENTE" : "APROVADO",
      isPrivate: true,
      expectedAmount: service.privatePrice,
    },
  });

  await scheduleAppointmentConfirmations(input.organizationId, appointment.id);

  if (service.isTeleconsult) {
    await createTeleconsultConsentForAppointment(
      input.organizationId,
      appointment.id,
      input.patientId,
    );
  }

  return appointment;
}

export async function approveOnlineAppointment(
  organizationId: string,
  appointmentId: string,
) {
  const db = createTenantClient(organizationId);
  return db.appointment.updateMany({
    where: {
      id: appointmentId,
      organizationId,
      origin: "ONLINE",
      onlineApprovalStatus: "PENDENTE",
    },
    data: {
      onlineApprovalStatus: "APROVADO",
      status: "CONFIRMADO",
    },
  });
}

export async function rejectOnlineAppointment(
  organizationId: string,
  appointmentId: string,
  reason?: string,
) {
  const db = createTenantClient(organizationId);
  return db.appointment.updateMany({
    where: {
      id: appointmentId,
      organizationId,
      origin: "ONLINE",
      onlineApprovalStatus: "PENDENTE",
    },
    data: {
      onlineApprovalStatus: "REJEITADO",
      status: "CANCELADO",
      cancelReason: reason ?? "Rejeitado pela clínica",
    },
  });
}

export async function listPendingOnlineApprovals(organizationId: string) {
  return adminPrisma.appointment.findMany({
    where: {
      organizationId,
      origin: "ONLINE",
      onlineApprovalStatus: "PENDENTE",
      deletedAt: null,
    },
    include: {
      patient: { select: { fullName: true, phoneSearch: true } },
      professional: { select: { displayName: true } },
      service: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
