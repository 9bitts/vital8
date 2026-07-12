import type { CommunicationOrigin } from "@/generated/prisma/client";

export type MessageChannel = "WHATSAPP" | "SMS" | "EMAIL";

export type WhatsAppTemplateComponent = {
  type: "body" | "button";
  sub_type?: "url";
  index?: string;
  parameters: Array<{ type: "text"; text: string }>;
};

export type OutboundMessage = {
  to: string;
  subject?: string;
  body: string;
  channel: MessageChannel;
  organizationId?: string;
  metadata?: Record<string, string>;
  /** WhatsApp Cloud API — template aprovado (fora da janela 24h) */
  templateName?: string;
  templateLanguage?: string;
  templateParams?: string[];
  templateComponents?: WhatsAppTemplateComponent[];
  /** País do paciente (BR, US…) para normalização de telefone */
  phoneCountry?: string;
  /** Origem da régua — resolve template via env quando templateName omitido */
  communicationOrigin?: CommunicationOrigin;
};

export type SendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  usedTemplate?: boolean;
};

export interface MessagingAdapter {
  send(message: OutboundMessage): Promise<SendResult>;
}
