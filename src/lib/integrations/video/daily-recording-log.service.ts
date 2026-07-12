import { adminPrisma } from "@/lib/db/admin-client";
import { isDailyCloudRecordingEnabled } from "./daily-config";

export async function logDailyRecording(params: {
  organizationId: string;
  encounterId: string;
  dailyRoomName: string;
}): Promise<void> {
  if (!isDailyCloudRecordingEnabled() || !params.dailyRoomName) return;
  try {
    await adminPrisma.dailyRecordingLog.create({
      data: {
        organizationId: params.organizationId,
        encounterId: params.encounterId,
        dailyRoomName: params.dailyRoomName,
        cloudRecording: true,
        status: "pending",
      },
    });
  } catch (e) {
    console.error("[DAILY RECORDING LOG]", e);
  }
}

export async function markDailyRecordingReady(params: {
  organizationId?: string;
  dailyRoomName: string;
  recordingId: string;
  downloadUrl?: string;
  durationSecs?: number;
}): Promise<void> {
  try {
    const row = await adminPrisma.dailyRecordingLog.findFirst({
      where: {
        dailyRoomName: params.dailyRoomName,
        ...(params.organizationId
          ? { organizationId: params.organizationId }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    if (!row) {
      const room = await adminPrisma.teleconsultRoom.findFirst({
        where: { roomName: params.dailyRoomName },
        select: { organizationId: true, encounterId: true },
      });
      if (!room) return;
      await adminPrisma.dailyRecordingLog.create({
        data: {
          organizationId: room.organizationId,
          encounterId: room.encounterId,
          dailyRoomName: params.dailyRoomName,
          cloudRecording: true,
          recordingId: params.recordingId,
          downloadUrl: params.downloadUrl,
          durationSecs: params.durationSecs,
          status: "ready",
          readyAt: new Date(),
        },
      });
      return;
    }
    await adminPrisma.dailyRecordingLog.update({
      where: { id: row.id },
      data: {
        recordingId: params.recordingId,
        downloadUrl: params.downloadUrl,
        durationSecs: params.durationSecs,
        status: "ready",
        readyAt: new Date(),
      },
    });
  } catch (e) {
    console.error("[DAILY RECORDING READY]", e);
  }
}

export async function markDailyMeetingEnded(params: {
  dailyRoomName: string;
  durationSecs?: number;
}): Promise<void> {
  try {
    await adminPrisma.dailyRecordingLog.updateMany({
      where: { dailyRoomName: params.dailyRoomName },
      data: {
        durationSecs: params.durationSecs,
        status: "ended",
      },
    });
  } catch (e) {
    console.error("[DAILY MEETING ENDED]", e);
  }
}
