"use server";

import { headers } from "next/headers";
import { checkRateLimit } from "../lib/rate-limit";
import { requestPortalOtp, verifyPortalOtp } from "../services/portal-auth.service";
import {
  createOnlineAppointment,
  getOnlineBookingContext,
  getPublicAvailableSlots,
  listBookableProfessionals,
  listBookableServices,
} from "../services/online-booking.service";

function clientIp(): string {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function getBookingContextAction(orgSlug: string) {
  const ctx = await getOnlineBookingContext(orgSlug);
  if (!ctx) return null;
  const services = await listBookableServices(ctx.org.id, ctx.config);
  return {
    orgName: ctx.org.name,
    welcomeText: ctx.config.welcomeText,
    requiresApproval: ctx.config.requiresApproval,
    services,
  };
}

export async function getBookingProfessionalsAction(orgSlug: string, serviceId: string) {
  const ctx = await getOnlineBookingContext(orgSlug);
  if (!ctx) return [];
  return listBookableProfessionals(ctx.org.id, serviceId, ctx.config);
}

export async function getBookingSlotsAction(input: {
  orgSlug: string;
  professionalId: string;
  serviceId: string;
  dateIso: string;
}) {
  const ctx = await getOnlineBookingContext(input.orgSlug);
  if (!ctx) return [];
  return getPublicAvailableSlots({
    organizationId: ctx.org.id,
    professionalId: input.professionalId,
    serviceId: input.serviceId,
    date: new Date(input.dateIso),
    config: ctx.config,
  });
}

export async function requestBookingOtpAction(orgSlug: string, phone: string) {
  const ctx = await getOnlineBookingContext(orgSlug);
  if (!ctx) throw new Error("Agendamento indisponível");
  const ip = clientIp();
  const limit = checkRateLimit(`book:ip:${ip}`, 20, 3600_000);
  if (!limit.allowed) throw new Error("Limite excedido. Tente mais tarde.");
  return requestPortalOtp({
    organizationId: ctx.org.id,
    phone,
    purpose: "BOOKING",
    ipKey: ip,
  });
}

export async function confirmBookingAction(input: {
  orgSlug: string;
  phone: string;
  otp: string;
  fullName?: string;
  professionalId: string;
  serviceId: string;
  startsAtIso: string;
}) {
  const ctx = await getOnlineBookingContext(input.orgSlug);
  if (!ctx) throw new Error("Agendamento indisponível");
  const ip = clientIp();
  const { patientId } = await verifyPortalOtp({
    organizationId: ctx.org.id,
    phone: input.phone,
    otp: input.otp,
    purpose: "BOOKING",
    fullName: input.fullName,
    ipAddress: ip,
  });
  const appointment = await createOnlineAppointment({
    organizationId: ctx.org.id,
    patientId,
    professionalId: input.professionalId,
    serviceId: input.serviceId,
    startsAt: new Date(input.startsAtIso),
    requiresApproval: ctx.config.requiresApproval,
  });
  return {
    appointmentId: appointment.id,
    pendingApproval: ctx.config.requiresApproval,
    startsAt: appointment.startsAt.toISOString(),
  };
}
