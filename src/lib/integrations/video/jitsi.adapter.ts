import type { VideoAdapter, VideoRoomInput, VideoRoomResult } from "./types";

export class JitsiVideoAdapter implements VideoAdapter {
  async createRoom(input: VideoRoomInput): Promise<VideoRoomResult> {
    const roomName = `vital8-${input.encounterId}`.replace(/[^a-zA-Z0-9-]/g, "");
    const expiresAt = new Date(
      Date.now() + (input.expiresInMinutes ?? 120) * 60_000,
    );
    return {
      provider: "jitsi",
      roomName,
      url: `https://meet.jit.si/${roomName}`,
      expiresAt,
    };
  }
}
