import type { CommunicationOrigin } from "@/generated/prisma/client";

const DEFAULT_BY_ORIGIN: Partial<Record<CommunicationOrigin, string>> = {
  CONFIRMACAO: "vital8_confirmacao",
  COBRANCA: "vital8_cobranca",
  NPS: "vital8_nps",
  LEMBRETE_RETORNO: "vital8_lembrete",
};

const ENV_BY_ORIGIN: Partial<Record<CommunicationOrigin, string>> = {
  CONFIRMACAO: "WHATSAPP_CONFIRM_TEMPLATE",
  COBRANCA: "WHATSAPP_BILLING_TEMPLATE",
  NPS: "WHATSAPP_NPS_TEMPLATE",
  LEMBRETE_RETORNO: "WHATSAPP_REMINDER_TEMPLATE",
};

export function getWhatsAppTemplateForOrigin(
  origin: CommunicationOrigin,
): string | undefined {
  const envKey = ENV_BY_ORIGIN[origin];
  if (envKey) {
    const fromEnv = process.env[envKey]?.trim();
    if (fromEnv) return fromEnv;
  }
  return DEFAULT_BY_ORIGIN[origin];
}
