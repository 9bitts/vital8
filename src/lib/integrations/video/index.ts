import { JitsiVideoAdapter } from "./jitsi.adapter";
import type { VideoAdapter } from "./types";

let adapter: VideoAdapter | null = null;

export function getVideoAdapter(): VideoAdapter {
  if (!adapter) {
    adapter = new JitsiVideoAdapter();
  }
  return adapter;
}

export type { VideoAdapter, VideoRoomInput, VideoRoomResult } from "./types";
