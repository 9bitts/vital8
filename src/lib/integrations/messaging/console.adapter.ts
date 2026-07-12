import type { MessagingAdapter, OutboundMessage, SendResult } from "./types";

/** Adapter de desenvolvimento — em produção não loga destino nem corpo (PHI). */
export class ConsoleMessagingAdapter implements MessagingAdapter {
  async send(message: OutboundMessage): Promise<SendResult> {
    const id = `console-${Date.now()}`;
    if (process.env.NODE_ENV === "production") {
      console.log("[Vital8 Messaging]", {
        id,
        channel: message.channel,
        metadata: message.metadata,
      });
    } else {
      console.log("[Vital8 Messaging]", {
        id,
        channel: message.channel,
        to: message.to,
        subject: message.subject,
        body: message.body,
        metadata: message.metadata,
      });
    }
    return { success: true, messageId: id };
  }
}
