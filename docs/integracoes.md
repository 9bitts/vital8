# Integrações externas — Vital8

Catálogo de providers reais portados do Doctor8 (Fase 17). Sem credenciais, adapters **mock/console** permanecem ativos.

## WhatsApp Cloud API (Meta) — Fase 17B

| Item | Caminho |
|------|---------|
| Adapter | `src/lib/integrations/messaging/whatsapp-cloud.adapter.ts` |
| Config por org | `MessagingSettings` + fallback env plataforma |
| Webhook | `GET/POST /api/webhooks/whatsapp` |
| Delivery log | `WhatsAppDeliveryLog` (por `organizationId`) |
| Status UI | `/app/configuracoes/integracoes` |

### Variáveis de ambiente

```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=              # alias: WHATSAPP_WEBHOOK_SECRET
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_GRAPH_API_VERSION=v22.0
WHATSAPP_DEFAULT_COUNTRY_CODE=55
WHATSAPP_TEMPLATE_LANG=pt_BR
WHATSAPP_REMINDER_TEMPLATE=vital8_lembrete
WHATSAPP_CONFIRM_TEMPLATE=vital8_confirmacao
WHATSAPP_BILLING_TEMPLATE=vital8_cobranca
WHATSAPP_NPS_TEMPLATE=vital8_nps
```

### Configuração por organização

Clínicas com WABA próprio podem gravar em `MessagingSettings`:

- `whatsappPhoneNumberId`
- `whatsappAccessTokenEncrypted` (via `phi.ts`)

Resolução: **org → env plataforma → console**. Ver `DECISOES.md`.

### Templates aprovados (Meta Business Manager)

Réguas transacionais usam templates utility:

- `vital8_confirmacao` — confirmação de consulta
- `vital8_lembrete` — lembrete / retorno
- `vital8_nps` — pesquisa NPS
- `vital8_cobranca` — cobrança

Marketing (`CAMPANHA`, `ANIVERSARIO`) envia texto livre com rodapé opt-out.

### Webhook

- **GET**: verificação Meta (`hub.verify_token`)
- **POST**: assinatura HMAC `X-Hub-Signature-256` + status delivery + inbound (confirm/cancel/opt-out/conversas)

## Stripe — Fase 17C

Dois usos distintos no Vital8 (sem Stripe Connect / split do marketplace Doctor8).

| Uso | Adapter | Webhook |
|-----|---------|---------|
| Assinatura SaaS (`/app/assinatura`) | `src/lib/integrations/billing/stripe.adapter.ts` | `POST /api/billing/webhook` |
| Cobrança paciente (link checkout) | `src/lib/integrations/payments/stripe.adapter.ts` | `POST /api/webhooks/payments` |

Idempotência: `ProcessedStripeEvent` (um registro por `event.id` da Stripe).

### Variáveis de ambiente

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PAYMENTS_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SUBSCRIPTION_PIX=0

# Price IDs — assinatura Vital8 (BRL)
STRIPE_PRICE_BASICO_MONTHLY=
STRIPE_PRICE_BASICO_ANNUAL=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_ANNUAL=
STRIPE_PRICE_ENTERPRISE_MONTHLY=
STRIPE_PRICE_ENTERPRISE_ANNUAL=
```

### Roteamento de pagamentos paciente

1. `STRIPE_SECRET_KEY` → Stripe Checkout (cartão + PIX hosted)
2. Senão `EFI_*` → PIX Efí
3. Senão mock

### Eventos webhook SaaS

- `checkout.session.completed` — ativa plano (`metadata.planKind=vital8_saas`)
- `customer.subscription.updated` — sincroniza status / inadimplência
- `customer.subscription.deleted` — cancela assinatura
- `invoice.payment_failed` — marca inadimplente

### Eventos webhook paciente

- `checkout.session.completed` — concilia `PatientPaymentLink` → `Receivable` + `Payment`
- `checkout.session.expired` — expira link

### Reembolso

`src/lib/integrations/payments/stripe-refund.ts` — estorno idempotente por `payment_intent` (sem Connect).

### Futuro

Stripe Connect para repasse a profissionais — fora do escopo 17C; ver `DECISOES.md`.

## Lacuna ICP-Brasil — Fase 17A

Assinatura digital PAdES via Rest PKI Core (port Doctor8).

| Item | Caminho |
|------|---------|
| Cliente API | `src/lib/integrations/digital-signature/lacuna-client.ts` |
| Fluxo sessão | `lacuna-signature.service.ts` |
| Provider | `ICP_LACUNA` em Configurações → Prontuário |
| Callback | `GET /api/digital-sign/callback` |
| Sessões | `LacunaSignatureSession` |

```env
LACUNA_API_KEY=
LACUNA_ENDPOINT=https://core.pki.rest
LACUNA_SECURITY_CONTEXT=
```

Fluxo: PDF → redirect BirdID/VIDaaS → callback → storage + `SignedClinicalDocument` + audit `clinical.sign`. Encounter vira `ASSINADO` no callback.

## Daily.co — Fase 17D

Teleconsulta com salas privadas Daily.co (port Doctor8). Sem `DAILY_API_KEY`, o adapter **Jitsi** permanece ativo.

| Item | Caminho |
|------|---------|
| Adapter | `src/lib/integrations/video/daily.adapter.ts` |
| Gravação | `daily-recording-log.service.ts` → `DailyRecordingLog` |
| Incidentes | `TeleconsultVideoIncident` |
| Webhook | `POST /api/webhooks/daily` |
| Join API | `GET /api/teleconsult/[encounterId]/video` |
| UI atendimento | `teleconsult-panel.tsx` no workspace do encounter |
| Status UI | `/app/configuracoes/integracoes` |

```env
DAILY_API_KEY=
DAILY_WEBHOOK_SECRET=          # base64 — painel Daily.co
DAILY_CLOUD_RECORDING=0        # 1 = gravação em nuvem nas salas
E2E_MOCK_DAILY=0               # 1 = mock em testes E2E
```

### Fluxo

1. Agendamento teleconsulta → `TeleconsultConsent` (CFM) via portal `/teleconsulta/[token]`
2. Profissional inicia atendimento → `createTeleconsultRoom` (valida consentimento)
3. `GET /api/teleconsult/[encounterId]/video` → token efêmero (Daily) ou link Jitsi
4. Webhook `recording.ready-to-download` → `DailyRecordingLog` com link de download
5. Incidentes de áudio/vídeo/conexão → `TeleconsultVideoIncident` + audit

## IA clínica — Fase 17E

Motores reais no adapter `llm`, consumidos pelo módulo `ai` existente (Fases 12 + 16G). UX, consentimento e limites **não mudam**.

| Capacidade | Provider | Uso no Vital8 |
|------------|----------|---------------|
| Texto (SOAP, CID, resumo, secretária) | Anthropic Messages API | `aiComplete` via `llm-gateway.service.ts` |
| Transcrição de áudio (Scribe) | OpenAI Whisper | `aiTranscribe` |

Roteamento: **Anthropic → complete**; **OpenAI → transcribe**; ausência de chave → mock determinístico por função.

| Item | Caminho |
|------|---------|
| Adapters | `src/lib/integrations/llm/` |
| Gateway | `src/modules/ai/services/llm-gateway.service.ts` |
| Scribe | `src/modules/ai/services/scribe.service.ts` |
| Status UI | `/app/configuracoes/integracoes` |

```env
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
OPENAI_API_KEY=
OPENAI_WHISPER_MODEL=whisper-1
E2E_MOCK_OPENAI=0
```

### Salvaguardas (inalteradas)

- `AiDataProcessingConsent` por recurso
- `minimize-payload.ts` antes de toda chamada externa
- `AiInteractionLog` criptografado + `AiUsageMonthly`
- Plano ENTERPRISE + `AiSettings.enabledResources`
- Scribe: consentimento do paciente (`PatientConsent`) antes da gravação

## TISS / Convênios — Fase 17F

Complemento da base multi-versão (Fase 16B) com regras portadas do Doctor8 4.01.

| Item | Caminho |
|------|---------|
| Validação de lote | `src/lib/tiss/batch-validation.ts` |
| CSV contábil | `src/lib/tiss/accounting-csv.ts` |
| Builder 4.03 | `src/lib/tiss/versions/4.03/builder.ts` |
| Readiness | `src/lib/tiss/tiss-readiness.ts` |
| Fechamento | `closeBatch()` em `batch.service.ts` |
| UI export | Botão "CSV contábil" no faturamento |

Versões suportadas: **3.05.00** (legado) e **4.03.00** (obrigatório jul/2026). `4.01`/`4.02` normalizados para 4.03.

Ver diff completo: `docs/tiss.md`.

## Infra de apoio — Fase 17G

Port Doctor8 — storage, mensageria, calendário e fiscal PF.

| Item | Caminho |
|------|---------|
| S3 storage | `src/lib/integrations/storage/s3.adapter.ts` |
| Roteamento storage | `src/lib/integrations/storage/index.ts` |
| SNS SMS | `src/lib/integrations/messaging/sns-sms.adapter.ts` |
| Roteamento messaging | `src/lib/integrations/messaging/index.ts` |
| Google Calendar OAuth | `src/lib/integrations/calendar/google-oauth.ts` |
| Sync agenda | `src/lib/integrations/calendar/sync.service.ts` |
| Callback OAuth | `GET /api/integrations/google-calendar/callback` |
| Receita Saúde | `src/modules/finance/services/receita-saude.service.ts` |
| Readiness | `src/lib/integrations/infra-readiness.ts` |
| Status UI | `/app/configuracoes/integracoes` |

### Variáveis de ambiente

```env
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=sa-east-1
AWS_S3_BUCKET=
AWS_SNS_SMS_ENABLED=0
AWS_SNS_SMS_PRODUCTION=0
AWS_SNS_REGION=
AWS_SNS_SENDER_ID=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
EMAIL_REPLY_TO=
E2E_MOCK_SNS=0
```

### Roteamento

- **Storage:** `AWS_S3_BUCKET` + credenciais → S3; senão `LocalStorageAdapter`
- **E-mail:** `RESEND_API_KEY` → Resend; senão console
- **SMS:** `AWS_SNS_SMS_ENABLED=1` → SNS; senão console (**não** usa WhatsApp)
- **WhatsApp:** inalterado (Fase 17B)
- **Calendar:** profissional conecta OAuth; sync em `CONFIRMADO`, `CANCELADO`, `REMARCADO`
- **Receita Saúde:** recibos PF + CSV Carnê-Leão no faturamento; checklist e links oficiais RF
