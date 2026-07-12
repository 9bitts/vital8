import type { MessagingAdapter, OutboundMessage, SendResult } from "./types";

/** Adapter de desenvolvimento — loga mensagens no console. */
export class ConsoleMessagingAdapter implements MessagingAdapter {
  async send(message: OutboundMessage): Promise<SendResult> {
    const id = `console-${Date.now()}`;
    console.log("[Vital8 Messaging]", {
      id,
      channel: message.channel,
      to: message.to,
      subject: message.subject,
      body: message.body,
      metadata: message.metadata,
    });
    return { success: true, messageId: id };
  }
}
