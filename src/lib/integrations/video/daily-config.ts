export function isDailyApiConfigured(): boolean {
  return Boolean(process.env.DAILY_API_KEY?.trim());
}

export function isDailyCloudRecordingEnabled(): boolean {
  return process.env.DAILY_CLOUD_RECORDING === "1";
}

export function dailyRoomBaseProperties(
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    enable_chat: true,
    enable_screenshare: true,
    enable_prejoin_ui: false,
    enable_knocking: false,
    eject_at_room_exp: true,
    ...extra,
  };
  if (isDailyCloudRecordingEnabled()) {
    base.enable_recording = "cloud";
  }
  return base;
}

export function buildDailyRoomName(
  organizationId: string,
  encounterId: string,
): string {
  const orgSlug = organizationId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const encSlug = encounterId.replace(/[^a-zA-Z0-9-]/g, "");
  return `vital8-${orgSlug}-${encSlug}`;
}
