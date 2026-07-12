"use client";

import { useState, useTransition } from "react";
import type { LacunaReadiness } from "@/lib/integrations/digital-signature/lacuna-readiness";
import type { DailyReadiness } from "@/lib/integrations/video";
import type { LlmReadiness } from "@/lib/integrations/llm";
import type { TissReadiness } from "@/lib/tiss/tiss-readiness";
import type { StripeReadiness } from "@/lib/integrations/billing/stripe-readiness";
import type { WhatsAppReadiness } from "@/lib/integrations/messaging/whatsapp-readiness";
import type { InfraReadiness } from "@/lib/integrations/infra-readiness";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { probeWhatsAppAction } from "@/modules/integrations/actions/integrations.actions";
import {
  disconnectGoogleCalendarAction,
  listGoogleCalendarLinksAction,
} from "@/modules/integrations/actions/calendar.actions";

export type CalendarLinkStatus = {
  professionalId: string;
  professionalName: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  isCurrentUser: boolean;
};

export function IntegrationsStatusPanel({
  whatsapp,
  stripe,
  lacuna,
  daily,
  llm,
  tiss,
  infra,
  calendarLinks,
}: {
  whatsapp: WhatsAppReadiness;
  stripe: StripeReadiness;
  lacuna: LacunaReadiness;
  daily: DailyReadiness;
  llm: LlmReadiness;
  tiss: TissReadiness;
  infra: InfraReadiness;
  calendarLinks: CalendarLinkStatus[];
}) {
  const [probeResult, setProbeResult] = useState<string | null>(null);
  const [links, setLinks] = useState(calendarLinks);
  const [isPending, startTransition] = useTransition();

  function runProbe() {
    startTransition(async () => {
      const res = await probeWhatsAppAction();
      if (res.success && res.data) {
        setProbeResult(
          res.data.ok ? `OK — ${res.data.detail}` : `Falha — ${res.data.detail}`,
        );
      } else {
        setProbeResult(res.success ? null : res.error);
      }
    });
  }

  function disconnectCalendar(professionalId: string) {
    startTransition(async () => {
      try {
        await disconnectGoogleCalendarAction(professionalId);
        const refreshed = await listGoogleCalendarLinksAction();
        setLinks(refreshed);
      } catch (e) {
        setProbeResult(e instanceof Error ? e.message : "Falha ao desconectar");
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">WhatsApp Cloud API</h2>
            <p className="text-sm text-zinc-600">
              Mensageria transacional — confirmação, lembrete, NPS, cobrança e conversas
            </p>
          </div>
          <Badge variant={whatsapp.productionReady ? "default" : "secondary"}>
            {whatsapp.productionReady
              ? "Produção"
              : whatsapp.configured
                ? "Parcial"
                : "Console (dev)"}
          </Badge>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Credenciais</dt>
            <dd>{whatsapp.configured ? `Ativo (${whatsapp.source})` : "Não configurado"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Template lembrete</dt>
            <dd className="font-mono text-xs">{whatsapp.reminderTemplate}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Webhook verify token</dt>
            <dd>{whatsapp.webhookConfigured ? "Sim" : "Não"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">App secret (HMAC)</dt>
            <dd>{whatsapp.appSecretConfigured ? "Sim" : "Não"}</dd>
          </div>
        </dl>

        <p className="text-sm text-zinc-600">{whatsapp.note}</p>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!whatsapp.configured || isPending}
            onClick={runProbe}
          >
            {isPending ? "Testando…" : "Testar token na Meta"}
          </Button>
          {probeResult && (
            <span className="text-sm text-zinc-700">{probeResult}</span>
          )}
        </div>

        <p className="text-xs text-zinc-500">
          Webhook: POST /api/webhooks/whatsapp
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">Stripe</h2>
            <p className="text-sm text-zinc-600">
              Assinatura SaaS das clínicas e links de pagamento para pacientes
            </p>
          </div>
          <Badge variant={stripe.productionReady ? "default" : "secondary"}>
            {stripe.productionReady
              ? "Produção"
              : stripe.configured
                ? "Parcial"
                : "Mock (dev)"}
          </Badge>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Secret key</dt>
            <dd>{stripe.configured ? "Sim" : "Não"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Publishable key</dt>
            <dd>{stripe.publishableKey ? "Sim" : "Não"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Webhook billing</dt>
            <dd>{stripe.billingWebhook ? "Sim" : "Não"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Webhook pagamentos</dt>
            <dd>{stripe.paymentsWebhook ? "Sim" : "Não"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Price IDs SaaS</dt>
            <dd>{stripe.priceIdsConfigured ? "Sim" : "Não"}</dd>
          </div>
        </dl>

        <p className="text-sm text-zinc-600">{stripe.note}</p>

        <p className="text-xs text-zinc-500">
          Webhooks: POST /api/billing/webhook · POST /api/webhooks/payments
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">Lacuna ICP-Brasil</h2>
            <p className="text-sm text-zinc-600">
              Assinatura digital PAdES — Encounter, Prescrição, Atestado
            </p>
          </div>
          <Badge variant={lacuna.configured ? "default" : "secondary"}>
            {lacuna.configured ? "Configurado" : "Indisponível"}
          </Badge>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Endpoint</dt>
            <dd className="font-mono text-xs">{lacuna.endpoint}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Security context</dt>
            <dd>{lacuna.securityContext ? "Sim" : "Padrão conta"}</dd>
          </div>
        </dl>

        <p className="text-sm text-zinc-600">{lacuna.note}</p>

        <p className="text-xs text-zinc-500">
          Callback: GET /api/digital-sign/callback · Provider: ICP_LACUNA em Configurações → Prontuário
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">Daily.co</h2>
            <p className="text-sm text-zinc-600">
              Teleconsulta com salas privadas, tokens efêmeros e gravação opcional
            </p>
          </div>
          <Badge variant={daily.productionReady ? "default" : "secondary"}>
            {daily.productionReady
              ? "Produção"
              : daily.configured
                ? "Parcial"
                : "Jitsi (dev)"}
          </Badge>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">API key</dt>
            <dd>{daily.configured ? "Sim" : "Não"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Gravação em nuvem</dt>
            <dd>{daily.cloudRecording ? "Ativa" : "Desativada"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Webhook</dt>
            <dd>{daily.webhookConfigured ? "Sim" : "Não"}</dd>
          </div>
        </dl>

        <p className="text-sm text-zinc-600">{daily.note}</p>

        <p className="text-xs text-zinc-500">
          Webhook: POST /api/webhooks/daily · Vídeo: GET /api/teleconsult/[encounterId]/video
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">IA clínica</h2>
            <p className="text-sm text-zinc-600">
              Copiloto, Scribe, secretária virtual — Anthropic + OpenAI Whisper
            </p>
          </div>
          <Badge variant={llm.productionReady ? "default" : "secondary"}>
            {llm.productionReady
              ? "Produção"
              : llm.configured
                ? "Parcial"
                : "Mock (dev)"}
          </Badge>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Anthropic (texto)</dt>
            <dd>{llm.anthropicConfigured ? llm.completeProvider : "Não"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">OpenAI Whisper (áudio)</dt>
            <dd>{llm.openaiConfigured ? llm.transcribeProvider : "Não"}</dd>
          </div>
        </dl>

        <p className="text-sm text-zinc-600">{llm.note}</p>

        <p className="text-xs text-zinc-500">
          Recursos: Scribe, Copiloto, Secretária — consentimento e limites em Configurações → IA
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">TISS / Convênios</h2>
            <p className="text-sm text-zinc-600">
              Faturamento ANS — XML 4.03, validação de lote e exportação contábil
            </p>
          </div>
          <Badge variant={tiss.productionReady ? "default" : "secondary"}>
            {tiss.productionReady
              ? "Pronto"
              : tiss.moduleAvailable
                ? "Parcial"
                : "Indisponível"}
          </Badge>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Operadoras</dt>
            <dd>{tiss.insurersConfigured}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Versões legadas</dt>
            <dd>{tiss.deprecatedVersionInsurers}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">CNES da clínica</dt>
            <dd>{tiss.orgCnesConfigured ? "Sim" : "Não"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Transporte</dt>
            <dd>{tiss.transportMode}</dd>
          </div>
        </dl>

        <p className="text-sm text-zinc-600">{tiss.note}</p>

        <p className="text-xs text-zinc-500">
          Versões: {tiss.supportedVersions.join(", ")} · Configuração: /app/configuracoes/convenios
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">Infra de apoio</h2>
            <p className="text-sm text-zinc-600">
              S3, Resend, AWS SNS SMS, Google Calendar e Receita Saúde
            </p>
          </div>
          <Badge variant={infra.productionReady ? "default" : "secondary"}>
            {infra.productionReady
              ? "Produção"
              : infra.s3Configured || infra.resendConfigured
                ? "Parcial"
                : "Local (dev)"}
          </Badge>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Armazenamento S3</dt>
            <dd>{infra.s3Configured ? "AWS S3" : "Disco local"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">E-mail (Resend)</dt>
            <dd>{infra.resendConfigured ? "Ativo" : "Console"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">SMS (AWS SNS)</dt>
            <dd>
              {infra.snsProductionReady
                ? "Produção"
                : infra.snsConfigured
                  ? "Sandbox"
                  : "Console"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Google Calendar</dt>
            <dd>{infra.calendarConfigured ? "OAuth pronto" : "Não configurado"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Receita Saúde</dt>
            <dd>{infra.receitaSaudeReady ? "Módulo fiscal" : "Indisponível"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Profissionais sincronizados</dt>
            <dd>{links.length}</dd>
          </div>
        </dl>

        <p className="text-sm text-zinc-600">{infra.note}</p>

        {infra.calendarConfigured && links.length > 0 && (
          <ul className="space-y-2 text-sm">
            {links.map((link) => (
              <li
                key={link.professionalId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-100 px-3 py-2"
              >
                <span>
                  {link.professionalName}
                  {link.lastSyncAt && (
                    <span className="ml-2 text-xs text-zinc-500">
                      sync {new Date(link.lastSyncAt).toLocaleString("pt-BR")}
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => disconnectCalendar(link.professionalId)}
                >
                  Desconectar
                </Button>
              </li>
            ))}
          </ul>
        )}

        {infra.calendarConfigured && links.some((l) => l.isCurrentUser) === false && (
          <p className="text-xs text-zinc-500">
            Profissionais conectam o Google Calendar via OAuth em Configurações → Agenda
            (ação disponível quando o usuário está vinculado a um cadastro profissional).
          </p>
        )}

        <p className="text-xs text-zinc-500">
          Callback Calendar: GET /api/integrations/google-calendar/callback · SMS roteado via SNS (não WhatsApp)
        </p>
      </section>
    </div>
  );
}
