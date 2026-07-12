import { adminPrisma } from "@/lib/db/admin-client";
import { encryptPHI, decryptPHI } from "@/lib/crypto/phi";
import {
  getAuthorizedCalendarClient,
} from "./google-oauth";
import { isGoogleCalendarConfigured } from "./google-config";

const ACTIVE_STATUSES = new Set(["AGENDADO", "CONFIRMADO", "AGUARDANDO"]);

export async function syncAppointmentToGoogleCalendar(
  appointmentId: string,
): Promise<void> {
  if (!isGoogleCalendarConfigured()) return;

  const appointment = await adminPrisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { select: { fullName: true } },
      professional: {
        include: { calendarLink: true },
      },
      service: { select: { name: true } },
    },
  });

  if (!appointment?.professional?.calendarLink?.syncEnabled) return;

  const link = appointment.professional.calendarLink;
  const refreshToken = decryptPHI(link.refreshTokenEncrypted);
  const accessToken = link.accessTokenEncrypted
    ? decryptPHI(link.accessTokenEncrypted)
    : null;

  const { calendar } = await getAuthorizedCalendarClient(
    refreshToken,
    accessToken,
  );

  if (!ACTIVE_STATUSES.has(appointment.status)) {
    if (appointment.googleCalendarEventId) {
      try {
        await calendar.events.delete({
          calendarId: link.calendarId,
          eventId: appointment.googleCalendarEventId,
        });
      } catch {
        /* already removed */
      }
      await adminPrisma.appointment.update({
        where: { id: appointmentId },
        data: { googleCalendarEventId: null },
      });
    }
    return;
  }

  const appUrl =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";

  const eventBody = {
    summary: `Consulta — ${appointment.patient.fullName}`,
    description: `${appointment.service.name}\nVital8: ${appUrl}/app/agenda`,
    start: {
      dateTime: appointment.startsAt.toISOString(),
      timeZone: "America/Sao_Paulo",
    },
    end: {
      dateTime: appointment.endsAt.toISOString(),
      timeZone: "America/Sao_Paulo",
    },
    extendedProperties: {
      private: {
        vital8AppointmentId: appointment.id,
        vital8Source: "1",
      },
    },
  };

  try {
    if (appointment.googleCalendarEventId) {
      await calendar.events.update({
        calendarId: link.calendarId,
        eventId: appointment.googleCalendarEventId,
        requestBody: eventBody,
      });
    } else {
      const res = await calendar.events.insert({
        calendarId: link.calendarId,
        requestBody: eventBody,
      });
      if (res.data.id) {
        await adminPrisma.appointment.update({
          where: { id: appointmentId },
          data: { googleCalendarEventId: res.data.id },
        });
      }
    }

    await adminPrisma.professionalCalendarLink.update({
      where: { id: link.id },
      data: { lastSyncAt: new Date() },
    });
  } catch (e) {
    console.error("[GOOGLE CALENDAR SYNC]", e);
  }
}

export async function saveProfessionalCalendarLink(input: {
  organizationId: string;
  professionalId: string;
  refreshToken: string;
  accessToken?: string | null;
  expiresAt?: Date | null;
}) {
  return adminPrisma.professionalCalendarLink.upsert({
    where: { professionalId: input.professionalId },
    create: {
      organizationId: input.organizationId,
      professionalId: input.professionalId,
      refreshTokenEncrypted: encryptPHI(input.refreshToken),
      accessTokenEncrypted: input.accessToken
        ? encryptPHI(input.accessToken)
        : null,
      tokenExpiresAt: input.expiresAt ?? null,
      syncEnabled: true,
    },
    update: {
      refreshTokenEncrypted: encryptPHI(input.refreshToken),
      accessTokenEncrypted: input.accessToken
        ? encryptPHI(input.accessToken)
        : null,
      tokenExpiresAt: input.expiresAt ?? null,
      syncEnabled: true,
    },
  });
}
