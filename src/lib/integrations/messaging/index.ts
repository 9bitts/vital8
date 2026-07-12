import { ConsoleMessagingAdapter } from "./console.adapter";
import { ResendEmailAdapter } from "./resend.adapter";
import { SnsSmsAdapter } from "./sns-sms.adapter";
import { isAwsSnsConfigured } from "./sns-sms.adapter";
import { WhatsAppCloudAdapter } from "./whatsapp-cloud.adapter";
import { resolveWhatsAppConfig } from "./whatsapp-config";
import type {
  MessagingAdapter,
  MessageChannel,
  OutboundMessage,
  SendResult,
} from "./types";

class RoutedMessagingAdapter implements MessagingAdapter {
  private console = new ConsoleMessagingAdapter();
  private resend: ResendEmailAdapter | null = null;
  private sns: SnsSmsAdapter | null = null;
  private whatsappCache = new Map<string, WhatsAppCloudAdapter>();

  constructor() {
    const resendKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM ?? "Vital8 <noreply@vital8.app>";
    if (resendKey) {
      this.resend = new ResendEmailAdapter(
        resendKey,
        emailFrom,
        process.env.EMAIL_REPLY_TO,
      );
    }
    if (isAwsSnsConfigured()) {
      this.sns = new SnsSmsAdapter();
    }
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    const adapter = await this.pick(message.channel, message.organizationId);
    return adapter.send(message);
  }

  private async pick(
    channel: MessageChannel,
    organizationId?: string,
  ): Promise<MessagingAdapter> {
    if (channel === "SMS") {
      return this.sns ?? this.console;
    }
    if (channel === "WHATSAPP") {
      const wa = await this.getWhatsAppAdapter(organizationId);
      return wa ?? this.console;
    }
    if (channel === "EMAIL") {
      return this.resend ?? this.console;
    }
    return this.console;
  }

  private async getWhatsAppAdapter(
    organizationId?: string,
  ): Promise<WhatsAppCloudAdapter | null> {
    const cacheKey = organizationId ?? "__platform__";
    const cached = this.whatsappCache.get(cacheKey);
    if (cached) return cached;

    const config = await resolveWhatsAppConfig(organizationId);
    if (!config) return null;

    const adapter = new WhatsAppCloudAdapter(config);
    this.whatsappCache.set(cacheKey, adapter);
    return adapter;
  }
}

let adapter: MessagingAdapter | null = null;

export function getMessagingAdapter(): MessagingAdapter {
  if (!adapter) {
    adapter = new RoutedMessagingAdapter();
  }
  return adapter;
}

export {
  getWhatsAppReadiness,
  probeWhatsAppGraph,
} from "./whatsapp-readiness";
export { getMessagingInfraReadiness } from "./messaging-infra-readiness";
export type { MessagingInfraReadiness } from "./messaging-infra-readiness";
export { resolveWhatsAppConfig, getEnvWhatsAppConfig } from "./whatsapp-config";
export type { MessagingAdapter, OutboundMessage, MessageChannel } from "./types";
