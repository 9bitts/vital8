import { logWhatsAppDelivery } from "./whatsapp-delivery-log.service";
import { normalizeWhatsAppPhone } from "./whatsapp-phone";
import { getWhatsAppTemplateForOrigin } from "./whatsapp-templates";
import type { WhatsAppCloudConfig } from "./whatsapp-config";
import type { MessagingAdapter, OutboundMessage, SendResult } from "./types";

function graphBase(config: WhatsAppCloudConfig): string {
  return `https://graph.facebook.com/${config.graphVersion}`;
}

function buildTemplateComponents(
  message: OutboundMessage,
): Array<Record<string, unknown>> | undefined {
  if (message.templateComponents?.length) {
    return message.templateComponents as Array<Record<string, unknown>>;
  }
  if (!message.templateParams?.length) return undefined;
  return [
    {
      type: "body",
      parameters: message.templateParams.map((text) => ({
        type: "text",
        text: text.slice(0, 256),
      })),
    },
  ];
}

export class WhatsAppCloudAdapter implements MessagingAdapter {
  constructor(private config: WhatsAppCloudConfig) {}

  async send(message: OutboundMessage): Promise<SendResult> {
    if (message.channel !== "WHATSAPP" && message.channel !== "SMS") {
      return {
        success: false,
        error: "WhatsApp adapter só suporta WHATSAPP/SMS",
      };
    }

    const to =
      normalizeWhatsAppPhone(message.to, this.config.defaultCountryCode) ??
      normalizeWhatsAppPhone(
        message.to.replace(/\D/g, ""),
        this.config.defaultCountryCode,
      );

    if (!to) {
      return { success: false, error: "Número de telefone inválido" };
    }

    const templateName =
      message.templateName ??
      (message.communicationOrigin
        ? getWhatsAppTemplateForOrigin(message.communicationOrigin)
        : undefined);

    const url = `${graphBase(this.config)}/${this.config.phoneNumberId}/messages`;

    const payload =
      templateName && message.channel === "WHATSAPP"
        ? {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to,
            type: "template",
            template: {
              name: templateName,
              language: {
                code: message.templateLanguage ?? this.config.templateLang,
              },
              components: buildTemplateComponents({
                ...message,
                templateName,
              }),
            },
          }
        : {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to,
            type: "text",
            text: { body: message.body },
          };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as {
        messages?: Array<{ id: string }>;
        error?: { message?: string };
      };

      if (!res.ok) {
        const error = data.error?.message || `HTTP ${res.status}`;
        if (message.organizationId) {
          await logWhatsAppDelivery({
            organizationId: message.organizationId,
            template: templateName,
            phone: to,
            status: "failed",
            detail: error,
          });
        }
        return { success: false, error };
      }

      const messageId = data.messages?.[0]?.id;
      if (message.organizationId) {
        await logWhatsAppDelivery({
          organizationId: message.organizationId,
          messageId,
          template: templateName,
          phone: to,
          status: "sent",
        });
      }

      return {
        success: true,
        messageId,
        usedTemplate: Boolean(templateName),
      };
    } catch (e) {
      const error = e instanceof Error ? e.message : "Erro WhatsApp";
      if (message.organizationId) {
        await logWhatsAppDelivery({
          organizationId: message.organizationId,
          template: templateName,
          phone: to,
          status: "failed",
          detail: error,
        });
      }
      return { success: false, error };
    }
  }
}
