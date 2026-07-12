import { isGoogleCalendarConfigured } from "./google-config";

export type CalendarReadiness = {
  configured: boolean;
  note: string;
};

export function getCalendarReadiness(): CalendarReadiness {
  const configured = isGoogleCalendarConfigured();
  return {
    configured,
    note: configured
      ? "OAuth Google Calendar pronto — profissionais conectam via OAuth."
      : "Google Calendar indisponível — defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.",
  };
}

export { isGoogleCalendarConfigured } from "./google-config";
export {
  buildGoogleCalendarAuthUrl,
  exchangeGoogleCalendarCode,
} from "./google-oauth";
export {
  syncAppointmentToGoogleCalendar,
  saveProfessionalCalendarLink,
} from "./sync.service";
