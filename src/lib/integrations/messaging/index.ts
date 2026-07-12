import { ConsoleMessagingAdapter } from "./console.adapter";
import type { MessagingAdapter } from "./types";

let adapter: MessagingAdapter | null = null;

export function getMessagingAdapter(): MessagingAdapter {
  if (!adapter) {
    adapter = new ConsoleMessagingAdapter();
  }
  return adapter;
}

export type { MessagingAdapter, OutboundMessage, MessageChannel } from "./types";
