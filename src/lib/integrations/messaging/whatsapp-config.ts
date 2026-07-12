import { adminPrisma } from "@/lib/db/admin-client";
import { decryptPHI } from "@/lib/crypto/phi";

export type WhatsAppCloudConfig = {
  phoneNumberId: string;
  accessToken: string;
  graphVersion: string;
  defaultCountryCode: string;
  templateLang: string;
};

function buildConfig(
  accessToken: string,
  phoneNumberId: string,
): WhatsAppCloudConfig {
  return {
    accessToken,
    phoneNumberId,
    graphVersion:
      process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v22.0",
    defaultCountryCode:
      process.env.WHATSAPP_DEFAULT_COUNTRY_CODE?.trim() || "55",
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "pt_BR",
  };
}

export function getEnvWhatsAppConfig(): WhatsAppCloudConfig | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneId) return null;
  return buildConfig(token, phoneId);
}

export async function resolveWhatsAppConfig(
  organizationId?: string,
): Promise<WhatsAppCloudConfig | null> {
  if (organizationId) {
    const settings = await adminPrisma.messagingSettings.findUnique({
      where: { organizationId },
      select: {
        whatsappAccessTokenEncrypted: true,
        whatsappPhoneNumberId: true,
      },
    });

    if (
      settings?.whatsappAccessTokenEncrypted &&
      settings.whatsappPhoneNumberId
    ) {
      try {
        const accessToken = decryptPHI(settings.whatsappAccessTokenEncrypted);
        return buildConfig(accessToken, settings.whatsappPhoneNumberId);
      } catch {
        // PHI key ausente ou token inválido — fallback para env global
      }
    }
  }

  return getEnvWhatsAppConfig();
}
