export type MessageChannel = "WHATSAPP" | "SMS" | "EMAIL";

export type OutboundMessage = {
  to: string;
  subject?: string;
  body: string;
  channel: MessageChannel;
  metadata?: Record<string, string>;
};

export type SendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export interface MessagingAdapter {
  send(message: OutboundMessage): Promise<SendResult>;
}
