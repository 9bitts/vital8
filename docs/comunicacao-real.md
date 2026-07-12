# Comunicação real — Fase 16F

WhatsApp Cloud API, e-mail transacional (Resend), PIX (Efí) e central de conversas.

## Variáveis de ambiente

```env
# WhatsApp Cloud API (Meta)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_WEBHOOK_SECRET=
WHATSAPP_GRAPH_API_VERSION=v22.0
WHATSAPP_DEFAULT_COUNTRY_CODE=55
WHATSAPP_TEMPLATE_LANG=pt_BR
WHATSAPP_REMINDER_TEMPLATE=vital8_lembrete

# E-mail transacional
RESEND_API_KEY=
EMAIL_FROM=Vital8 <noreply@sua-clinica.com.br>
EMAIL_REPLY_TO=

# PIX Efí (Gerencianet)
EFI_CLIENT_ID=
EFI_CLIENT_SECRET=
EFI_PIX_KEY=
EFI_SANDBOX=true

# Webhook conciliação PIX
PAYMENTS_WEBHOOK_SECRET=
```

Sem credenciais, os adapters **console** (mensagens) e **mock** (PIX) permanecem ativos.

## WhatsApp

- Adapter: `src/lib/integrations/messaging/whatsapp-cloud.adapter.ts`
- Webhook: `GET/POST /api/webhooks/whatsapp` (HMAC em produção)
- Templates aprovados na fila: configuráveis via env (`WHATSAPP_*_TEMPLATE`)
- Fora da janela 24h: usa template; dentro: texto livre
- Botões inbound: `confirm_{token}`, `cancel_{token}`, `OPT_OUT`
- Opt-out sincronizado com `PatientOptOut`
- Delivery log: `WhatsAppDeliveryLog` por organização
- Status: `/app/configuracoes/integracoes`
- Detalhes: `docs/integracoes.md`

## E-mail

- Adapter Resend quando `RESEND_API_KEY` definido
- Canal `EMAIL` na fila `CommunicationLog`

## PIX

- Adapter Efí: `src/lib/integrations/payments/efi-pix.adapter.ts`
- Links persistidos em `PatientPaymentLink`
- Página pública: `/pagamento/[linkId]` com QR e copia-e-cola
- Webhook: `POST /api/webhooks/payments` — concilia `Receivable` + `Payment`

## Central de conversas

- Tela: `/app/relacionamento/conversas`
- Modelos: `ConversationThread`, `ConversationMessage`
- Inbound WhatsApp → IA secretária (`processSecretaryMessage`) + handoff
- Resposta manual com sugestão IA (`VIRTUAL_SECRETARY`)

## Agendamento online — pré-pagamento

`OnlineBookingConfig.requirePrepayment` e `prepaymentPercent` (migration 16F).

## Testes

```bash
npx vitest run src/lib/integrations/messaging/whatsapp-cloud.adapter.test.ts
npx vitest run src/lib/integrations/payments/efi-pix.adapter.test.ts
```
