import { google } from "googleapis";
import {
  getGoogleCalendarRedirectUri,
  GOOGLE_CALENDAR_SCOPES,
  isGoogleCalendarConfigured,
} from "./google-config";

export function createGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getGoogleCalendarRedirectUri(),
  );
}

export function buildGoogleCalendarAuthUrl(state: string): string {
  const client = createGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_CALENDAR_SCOPES,
    state,
  });
}

export async function exchangeGoogleCalendarCode(code: string) {
  if (!isGoogleCalendarConfigured()) {
    throw new Error("Google Calendar não configurado");
  }
  const client = createGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("NO_REFRESH_TOKEN");
  }
  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token ?? null,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}

export async function getAuthorizedCalendarClient(
  refreshToken: string,
  accessToken?: string | null,
) {
  const client = createGoogleOAuthClient();
  client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken ?? undefined,
  });
  return {
    auth: client,
    calendar: google.calendar({ version: "v3", auth: client }),
  };
}
