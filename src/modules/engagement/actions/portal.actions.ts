"use server";

import { headers } from "next/headers";
import { adminPrisma } from "@/lib/db/admin-client";
import { hasFeature } from "@/lib/features/features.service";
import { getPortalSessionFromCookie } from "../lib/portal-session";
import { requestPortalOtp, verifyPortalOtp } from "../services/portal-auth.service";
import {
  cancelPortalAppointment,
  getPortalDashboard,
  logPortalAccess,
  requestPatientDataCorrection,
} from "../services/portal.service";
import { setOptOut } from "../services/opt-out.service";
import { submitNpsResponse } from "../services/nps.service";
import { acceptTeleconsultConsent, getConsentTermText } from "../services/teleconsult.service";

function clientIp(): string {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function requestPortalLoginOtpAction(orgSlug: string, phone: string) {
  const org = await adminPrisma.organization.findFirst({
    where: { slug: orgSlug, isActive: true },
  });
  if (!org || !hasFeature(org.plan, "patient_portal")) {
    throw new Error("Portal indisponível");
  }
  return requestPortalOtp({
    organizationId: org.id,
    phone,
    purpose: "PORTAL_LOGIN",
    ipKey: clientIp(),
  });
}

export async function verifyPortalLoginAction(orgSlug: string, phone: string, otp: string) {
  const org = await adminPrisma.organization.findFirstOrThrow({
    where: { slug: orgSlug },
  });
  return verifyPortalOtp({
    organizationId: org.id,
    phone,
    otp,
    purpose: "PORTAL_LOGIN",
    ipAddress: clientIp(),
  });
}

export async function getPortalDashboardAction() {
  const session = await getPortalSessionFromCookie();
  if (!session) return null;
  await logPortalAccess(session, "PATIENT_PORTAL", session.patientId, {
    ipAddress: clientIp(),
  });
  return getPortalDashboard(session);
}

export async function cancelPortalAppointmentAction(appointmentId: string) {
  const session = await getPortalSessionFromCookie();
  if (!session) throw new Error("Sessão expirada");
  return cancelPortalAppointment(session, appointmentId);
}

export async function requestCorrectionAction(fields: Record<string, string>, message?: string) {
  const session = await getPortalSessionFromCookie();
  if (!session) throw new Error("Sessão expirada");
  return requestPatientDataCorrection(session, fields, message);
}

export async function publicOptOutAction(patientId: string, organizationId: string) {
  await setOptOut(organizationId, patientId, "MARKETING", null);
  return { ok: true };
}

export async function submitNpsAction(token: string, score: number, comment?: string) {
  return submitNpsResponse({ token, score, comment });
}

export async function getTeleconsultConsentAction(token: string) {
  const consent = await adminPrisma.teleconsultConsent.findUnique({
    where: { token },
    include: {
      patient: { select: { fullName: true } },
      appointment: {
        include: {
          professional: { select: { displayName: true } },
          service: { select: { name: true } },
        },
      },
    },
  });
  if (!consent) return null;
  return {
    patientName: consent.patient.fullName,
    professionalName: consent.appointment.professional.displayName,
    serviceName: consent.appointment.service.name,
    termVersion: consent.termVersion,
    accepted: Boolean(consent.acceptedAt),
    termText: getConsentTermText(),
  };
}

export async function acceptTeleconsultConsentAction(token: string) {
  return acceptTeleconsultConsent({
    token,
    ipAddress: clientIp(),
    userAgent: headers().get("user-agent") ?? undefined,
  });
}
