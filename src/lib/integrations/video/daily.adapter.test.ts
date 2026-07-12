import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildDailyRoomName } from "./daily-config";
import { DailyVideoAdapter } from "./daily.adapter";

vi.mock("./daily-recording-log.service", () => ({
  logDailyRecording: vi.fn().mockResolvedValue(undefined),
}));

import { logDailyRecording } from "./daily-recording-log.service";

describe("buildDailyRoomName", () => {
  it("prefixes org and encounter", () => {
    const name = buildDailyRoomName("org123abc", "enc456def");
    expect(name).toMatch(/^vital8-org123ab-enc456def$/);
  });
});

describe("DailyVideoAdapter", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("DAILY_API_KEY", "test-key");
    vi.stubEnv("DAILY_CLOUD_RECORDING", "1");
    vi.mocked(logDailyRecording).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a private room and logs recording", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: "vital8-org1-enc1",
        url: "https://vital8.daily.co/vital8-org1-enc1",
      }),
    });

    const adapter = new DailyVideoAdapter();
    const result = await adapter.createRoom({
      organizationId: "org1",
      encounterId: "enc1",
      expiresInMinutes: 90,
    });

    expect(result.provider).toBe("daily");
    expect(result.url).toContain("daily.co");
    expect(logDailyRecording).toHaveBeenCalledWith({
      organizationId: "org1",
      encounterId: "enc1",
      dailyRoomName: "vital8-org1-enc1",
    });
  });

  it("returns existing room on duplicate name", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, text: async () => "exists" })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "vital8-org1-enc1",
          url: "https://vital8.daily.co/vital8-org1-enc1",
          config: { exp: Math.floor(Date.now() / 1000) + 3600 },
        }),
      });

    const adapter = new DailyVideoAdapter();
    const result = await adapter.createRoom({
      organizationId: "org1",
      encounterId: "enc1",
    });

    expect(result.roomName).toBe("vital8-org1-enc1");
    expect(logDailyRecording).not.toHaveBeenCalled();
  });

  it("creates meeting token", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "tok-abc" }),
      });

    const adapter = new DailyVideoAdapter();
    const token = await adapter.createMeetingToken({
      roomName: "vital8-org1-enc1",
      userName: "Dr. Silva",
      isOwner: true,
      expiresAtUnix: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(token).toBe("tok-abc");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/meeting-tokens"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("detects expired room as not joinable", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        config: { exp: Math.floor(Date.now() / 1000) - 120 },
      }),
    });

    const adapter = new DailyVideoAdapter();
    const joinable = await adapter.isRoomJoinable("vital8-org1-enc1");
    expect(joinable).toBe(false);
  });
});
