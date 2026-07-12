import {
  getEnvWhatsAppConfig,
  resolveWhatsAppConfig,
  type WhatsAppCloudConfig,
} from "./whatsapp-config";

export type WhatsAppReadiness = {
  configured: boolean;
  source: "organization" | "platform" | "none";
  reminderTemplate: string;
  webhookConfigured: boolean;
  appSecretConfigured: boolean;
  productionReady: boolean;
  note: string;
};

function getAppSecretConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_APP_SECRET?.trim() ||
      process.env.WHATSAPP_WEBHOOK_SECRET?.trim(),
  );
}

export async function getWhatsAppReadiness(
  organizationId?: string,
): Promise<WhatsAppReadiness> {
  const orgConfig = organizationId
    ? await resolveWhatsAppConfig(organizationId)
    : null;
  const envConfig = getEnvWhatsAppConfig();
  const configured = Boolean(orgConfig ?? envConfig);
  const source: WhatsAppReadiness["source"] = orgConfig
    ? "organization"
    : envConfig
      ? "platform"
      : "none";

  const reminderTemplate =
    process.env.WHATSAPP_REMINDER_TEMPLATE?.trim() || "vital8_lembrete";
  const webhookConfigured = Boolean(
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim(),
  );
  const appSecretConfigured = getAppSecretConfigured();
  const productionReady =
    configured && webhookConfigured && appSecretConfigured;

  let note: string;
  if (!configured) {
    note =
      "WhatsApp não configurado — mensagens usam adapter console até definir credenciais (env ou MessagingSettings da organização).";
  } else if (productionReady) {
    note = `Stack pronto (${source}). Template "${reminderTemplate}" deve estar aprovado na Meta Business Manager.`;
  } else if (!webhookConfigured) {
    note =
      "Credenciais definidas. Configure WHATSAPP_WEBHOOK_VERIFY_TOKEN e assine o webhook em POST /api/webhooks/whatsapp.";
  } else if (!appSecretConfigured) {
    note =
      "Credenciais + webhook definidos. Adicione WHATSAPP_APP_SECRET para verificação HMAC do webhook.";
  } else {
    note = "Credenciais definidas. Complete webhook + app secret para produção.";
  }

  return {
    configured,
    source,
    reminderTemplate,
    webhookConfigured,
    appSecretConfigured,
    productionReady,
    note,
  };
}

/** Optional live probe — validates token against Graph API (admin only). */
export async function probeWhatsAppGraph(
  organizationId?: string,
): Promise<{ ok: boolean; detail: string }> {
  const config: WhatsAppCloudConfig | null = organizationId
    ? await resolveWhatsAppConfig(organizationId)
    : getEnvWhatsAppConfig();

  if (!config) {
    return { ok: false, detail: "Não configurado" };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}?fields=display_phone_number,verified_name`,
      {
        headers: { Authorization: `Bearer ${config.accessToken}` },
        next: { revalidate: 300 },
      },
    );
    const data = (await res.json()) as {
      display_phone_number?: string;
      verified_name?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        detail: data.error?.message || `HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      detail: `${data.verified_name || "WhatsApp"} · ${data.display_phone_number || config.phoneNumberId}`,
    };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : "Falha no probe",
    };
  }
}
