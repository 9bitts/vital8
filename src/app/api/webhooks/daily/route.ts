import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isDailyCloudRecordingEnabled } from "@/lib/integrations/video/daily-config";
import {
  getDailyRecordingAccessLink,
} from "@/lib/integrations/video/daily.adapter";
import {
  markDailyMeetingEnded,
  markDailyRecordingReady,
} from "@/lib/integrations/video/daily-recording-log.service";

export const dynamic = "force-dynamic";

function verifyDailySignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
): boolean {
  const secret = process.env.DAILY_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  if (!signature || !timestamp) return false;

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const base64DecodedSecret = Buffer.from(secret, "base64");
  const signedPayload = `${timestamp}.${JSON.stringify(event)}`;
  const computed = crypto
    .createHmac("sha256", base64DecodedSecret)
    .update(signedPayload)
    .digest("base64");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(signature),
    );
  } catch {
    return computed === signature;
  }
}

type DailyWebhookEvent = {
  test?: string;
  type?: string;
  payload?: {
    room_name?: string;
    recording_id?: string;
    duration?: number;
  };
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let event: DailyWebhookEvent;
  try {
    event = JSON.parse(rawBody) as DailyWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.test === "test") {
    return NextResponse.json({ ok: true });
  }

  const signature = req.headers.get("x-webhook-signature");
  const timestamp = req.headers.get("x-webhook-timestamp");

  if (!verifyDailySignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type === "meeting.ended") {
    const roomName = event.payload?.room_name;
    const durationSecs = event.payload?.duration;
    if (roomName) {
      await markDailyMeetingEnded({ dailyRoomName: roomName, durationSecs });
    }
    return NextResponse.json({ received: true, type: event.type, roomName });
  }

  if (event.type !== "recording.ready-to-download") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  if (!isDailyCloudRecordingEnabled()) {
    return NextResponse.json({
      received: true,
      skipped: "cloud recording disabled",
    });
  }

  const roomName = event.payload?.room_name;
  const recordingId = event.payload?.recording_id;
  if (!roomName || !recordingId) {
    return NextResponse.json({ received: true, skipped: "missing fields" });
  }

  const access = await getDailyRecordingAccessLink(recordingId);
  await markDailyRecordingReady({
    dailyRoomName: roomName,
    recordingId,
    downloadUrl: access?.downloadUrl,
    durationSecs: access?.durationSecs ?? event.payload?.duration,
  });

  return NextResponse.json({ received: true, roomName, recordingId });
}
