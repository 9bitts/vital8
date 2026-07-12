import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { MessagingAdapter, OutboundMessage, SendResult } from "./types";

function normalizeSmsPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function isAwsSnsConfigured(): boolean {
  return Boolean(
    process.env.AWS_SNS_SMS_ENABLED?.trim() === "1" &&
      process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim(),
  );
}

export function isAwsSnsProductionReady(): boolean {
  return (
    isAwsSnsConfigured() &&
    process.env.AWS_SNS_SMS_PRODUCTION?.trim() === "1"
  );
}

function getSnsRegion(): string {
  return (
    process.env.AWS_SNS_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "sa-east-1"
  );
}

export class SnsSmsAdapter implements MessagingAdapter {
  private client: SNSClient;

  constructor() {
    this.client = new SNSClient({
      region: getSnsRegion(),
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
      },
    });
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    if (message.channel !== "SMS") {
      return { success: false, error: "SNS adapter só suporta SMS" };
    }

    if (process.env.E2E_MOCK_SNS === "1") {
      return { success: true, messageId: "e2e-mock-sms" };
    }

    const to = normalizeSmsPhone(message.to);
    if (!to) {
      return { success: false, error: "Telefone inválido para SMS" };
    }

    const senderId = process.env.AWS_SNS_SENDER_ID?.trim();

    try {
      const res = await this.client.send(
        new PublishCommand({
          PhoneNumber: `+${to}`,
          Message: message.body,
          MessageAttributes: senderId
            ? {
                "AWS.SNS.SMS.SenderID": {
                  DataType: "String",
                  StringValue: senderId.slice(0, 11),
                },
                "AWS.SNS.SMS.SMSType": {
                  DataType: "String",
                  StringValue: "Transactional",
                },
              }
            : {
                "AWS.SNS.SMS.SMSType": {
                  DataType: "String",
                  StringValue: "Transactional",
                },
              },
        }),
      );
      return { success: true, messageId: res.MessageId };
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Falha SNS";
      console.error("[AWS SNS]", detail);
      return { success: false, error: detail.slice(0, 200) };
    }
  }
}
