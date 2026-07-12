import { MockPushAdapter, WebPushAdapter } from "./mock.adapter";
import type { PushAdapter } from "./types";

let adapter: PushAdapter | null = null;

function isNonDevEnv(): boolean {
  const env = process.env.NODE_ENV ?? "development";
  return env !== "development" && env !== "test";
}

export function getPushAdapter(): PushAdapter {
  if (!adapter) {
    const hasVapid =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY;
    if (hasVapid && isNonDevEnv()) {
      adapter = new WebPushAdapter();
    } else {
      adapter = new MockPushAdapter();
    }
  }
  return adapter;
}

export type { PushAdapter, PushPayload, PushSubscriptionInput } from "./types";
