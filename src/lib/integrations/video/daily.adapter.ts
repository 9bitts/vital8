import {
  buildDailyRoomName,
  dailyRoomBaseProperties,
  isDailyApiConfigured,
} from "./daily-config";
import { logDailyRecording } from "./daily-recording-log.service";
import type {
  MeetingTokenInput,
  VideoAdapter,
  VideoRoomInput,
  VideoRoomResult,
} from "./types";

const DAILY_API = "https://api.daily.co/v1";

function headers(): Record<string, string> {
  const key = process.env.DAILY_API_KEY?.trim();
  if (!key) throw new Error("DAILY_API_KEY is not set");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

function roomExpiry(input: VideoRoomInput): { nbf: number; exp: number } {
  const durationMins = input.durationMinutes ?? 30;
  const bufferMins = input.expiresInMinutes ?? 120;

  if (input.scheduledAt) {
    const nbf = Math.floor(input.scheduledAt.getTime() / 1000) - 15 * 60;
    const exp =
      Math.floor(input.scheduledAt.getTime() / 1000) +
      (durationMins + 60) * 60;
    return { nbf, exp };
  }

  const now = Math.floor(Date.now() / 1000);
  return {
    nbf: now - 60,
    exp: now + bufferMins * 60,
  };
}

async function ensureRoomDirectJoin(roomName: string): Promise<void> {
  if (process.env.E2E_MOCK_DAILY === "1") return;
  try {
    await fetch(`${DAILY_API}/rooms/${encodeURIComponent(roomName)}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        properties: { enable_prejoin_ui: false },
      }),
    });
  } catch {
    /* non-fatal */
  }
}

export class DailyVideoAdapter implements VideoAdapter {
  readonly provider = "daily";

  async createRoom(input: VideoRoomInput): Promise<VideoRoomResult> {
    if (!isDailyApiConfigured()) {
      throw new Error("DAILY_API_KEY is not set");
    }

    if (process.env.E2E_MOCK_DAILY === "1") {
      const roomName = buildDailyRoomName(
        input.organizationId,
        input.encounterId,
      );
      const expiresAt = new Date(
        Date.now() + (input.expiresInMinutes ?? 120) * 60_000,
      );
      return {
        provider: this.provider,
        roomName,
        url: `https://mock.daily.co/${roomName}`,
        expiresAt,
      };
    }

    const roomName = buildDailyRoomName(
      input.organizationId,
      input.encounterId,
    );
    const { nbf, exp } = roomExpiry(input);

    const createRes = await fetch(`${DAILY_API}/rooms`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: dailyRoomBaseProperties({
          nbf,
          exp,
          max_participants: 4,
        }),
      }),
    });

    if (createRes.ok) {
      const room = (await createRes.json()) as { name: string; url: string };
      await logDailyRecording({
        organizationId: input.organizationId,
        encounterId: input.encounterId,
        dailyRoomName: room.name,
      });
      return {
        provider: this.provider,
        roomName: room.name,
        url: room.url,
        expiresAt: new Date(exp * 1000),
      };
    }

    const getRes = await fetch(`${DAILY_API}/rooms/${roomName}`, {
      headers: headers(),
    });

    if (getRes.ok) {
      const room = (await getRes.json()) as { name: string; url: string };
      const roomExp = (room as { config?: { exp?: number } }).config?.exp;
      return {
        provider: this.provider,
        roomName: room.name,
        url: room.url,
        expiresAt: new Date(
          (roomExp ?? exp) * 1000,
        ),
      };
    }

    const err = await createRes.text();
    console.error("[DAILY] Failed to create room:", err);
    throw new Error("Could not create video room");
  }

  async createMeetingToken(input: MeetingTokenInput): Promise<string> {
    if (process.env.E2E_MOCK_DAILY === "1") {
      return "e2e-mock-token";
    }

    await ensureRoomDirectJoin(input.roomName);

    const res = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        properties: {
          room_name: input.roomName,
          user_name: input.userName,
          is_owner: input.isOwner,
          exp: input.expiresAtUnix,
        },
      }),
    });

    if (!res.ok) {
      console.error("[DAILY] Failed to create token:", await res.text());
      throw new Error("Could not create meeting token");
    }

    const data = (await res.json()) as { token: string };
    return data.token;
  }

  async isRoomJoinable(roomName: string): Promise<boolean> {
    if (!isDailyApiConfigured() || process.env.E2E_MOCK_DAILY === "1") {
      return true;
    }
    try {
      const res = await fetch(`${DAILY_API}/rooms/${roomName}`, {
        headers: headers(),
      });
      if (res.status === 404) return false;
      if (!res.ok) return true;
      const data = (await res.json()) as { config?: { exp?: number } };
      const exp = data?.config?.exp;
      if (typeof exp === "number" && exp * 1000 < Date.now() + 60_000) {
        return false;
      }
      return true;
    } catch {
      return true;
    }
  }
}

export async function getDailyRecordingAccessLink(
  recordingId: string,
): Promise<{ downloadUrl: string; durationSecs?: number } | null> {
  const key = process.env.DAILY_API_KEY?.trim();
  if (!key || !recordingId) return null;

  try {
    const res = await fetch(
      `${DAILY_API}/recordings/${recordingId}/access-link`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) {
      console.error("[DAILY] recording access-link failed:", await res.text());
      return null;
    }
    const data = (await res.json()) as {
      download_link?: string;
      duration?: number;
    };
    if (!data.download_link) return null;
    return {
      downloadUrl: data.download_link,
      durationSecs:
        typeof data.duration === "number" ? data.duration : undefined,
    };
  } catch (e) {
    console.error("[DAILY] recording access-link error:", e);
    return null;
  }
}
