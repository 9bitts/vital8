import type { MessagingAdapter, OutboundMessage, SendResult } from "./types";

const RESEND_API = "https://api.resend.com/emails";

export class ResendEmailAdapter implements MessagingAdapter {
  constructor(
    private apiKey: string,
    private from: string,
    private replyTo?: string,
  ) {}

  async send(message: OutboundMessage): Promise<SendResult> {
    if (message.channel !== "EMAIL") {
      return { success: false, error: "Resend adapter só suporta EMAIL" };
    }

    try {
      const res = await fetch(RESEND_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject ?? "Vital8",
          text: message.body,
          reply_to: this.replyTo,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: err.slice(0, 200) };
      }

      const data = (await res.json()) as { id?: string };
      return { success: true, messageId: data.id };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Erro Resend",
      };
    }
  }
}
