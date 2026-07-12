import { isDailyApiConfigured } from "./daily-config";
import { DailyVideoAdapter } from "./daily.adapter";
import { JitsiVideoAdapter } from "./jitsi.adapter";
import type { VideoAdapter } from "./types";

let adapter: VideoAdapter | null = null;

export function getVideoAdapter(): VideoAdapter {
  if (!adapter) {
    adapter = isDailyApiConfigured()
      ? new DailyVideoAdapter()
      : new JitsiVideoAdapter();
  }
  return adapter;
}

export { getDailyReadiness } from "./daily-readiness";
export type { DailyReadiness } from "./daily-readiness";
export type {
  VideoAdapter,
  VideoRoomInput,
  VideoRoomResult,
  MeetingTokenInput,
} from "./types";
