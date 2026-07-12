import {
  isDailyApiConfigured,
  isDailyCloudRecordingEnabled,
} from "./daily-config";

export type DailyReadiness = {
  configured: boolean;
  cloudRecording: boolean;
  webhookConfigured: boolean;
  productionReady: boolean;
  note: string;
};

export function getDailyReadiness(): DailyReadiness {
  const configured = isDailyApiConfigured();
  const cloudRecording = isDailyCloudRecordingEnabled();
  const webhookConfigured = Boolean(process.env.DAILY_WEBHOOK_SECRET?.trim());
  const productionReady = configured && webhookConfigured;

  let note: string;
  if (!configured) {
    note =
      "Daily.co não configurado — teleconsulta usa Jitsi (link público) até definir DAILY_API_KEY.";
  } else if (productionReady) {
    note = cloudRecording
      ? "Daily ativo com gravação em nuvem. Webhook registra gravações prontas."
      : "Daily ativo (salas privadas + tokens). Ative DAILY_CLOUD_RECORDING=1 para gravar.";
  } else if (!webhookConfigured) {
    note =
      "DAILY_API_KEY definida. Configure DAILY_WEBHOOK_SECRET e aponte POST /api/webhooks/daily no painel Daily.";
  } else {
    note = "Daily parcialmente configurado.";
  }

  return {
    configured,
    cloudRecording,
    webhookConfigured,
    productionReady,
    note,
  };
}
