import { isS3Configured } from "@/lib/integrations/storage/s3-config";
import { getMessagingInfraReadiness } from "@/lib/integrations/messaging/messaging-infra-readiness";
import { getCalendarReadiness } from "@/lib/integrations/calendar";

export type InfraReadiness = {
  s3Configured: boolean;
  resendConfigured: boolean;
  snsConfigured: boolean;
  snsProductionReady: boolean;
  calendarConfigured: boolean;
  receitaSaudeReady: boolean;
  productionReady: boolean;
  note: string;
};

export function getInfraReadiness(): InfraReadiness {
  const messaging = getMessagingInfraReadiness();
  const calendar = getCalendarReadiness();
  const s3Configured = isS3Configured();
  const receitaSaudeReady = true;

  const productionReady =
    s3Configured &&
    messaging.resendConfigured &&
    messaging.snsProductionReady &&
    calendar.configured;

  let note: string;
  if (productionReady) {
    note =
      "Infra de apoio completa: S3, Resend, SNS produção e Google Calendar.";
  } else {
    const parts: string[] = [];
    if (!s3Configured) parts.push("S3/local disk");
    if (!messaging.resendConfigured) parts.push("Resend");
    if (!messaging.snsConfigured) parts.push("SNS SMS");
    else if (!messaging.snsProductionReady) parts.push("SNS sandbox");
    if (!calendar.configured) parts.push("Google Calendar");
    note = `Parcial — pendente: ${parts.join(", ") || "nenhum"}. Receita Saúde integrada ao módulo fiscal.`;
  }

  return {
    s3Configured,
    resendConfigured: messaging.resendConfigured,
    snsConfigured: messaging.snsConfigured,
    snsProductionReady: messaging.snsProductionReady,
    calendarConfigured: calendar.configured,
    receitaSaudeReady,
    productionReady,
    note,
  };
}
