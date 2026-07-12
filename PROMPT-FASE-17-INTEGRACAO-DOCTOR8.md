# PROMPT — FASE 17: PORTAR INTEGRAÇÕES REAIS DO DOCTOR8 (copiar e colar no Cursor)

> **Pré-requisito:** Fase 16 concluída (typecheck, build e testes verdes). Só iniciar após meu OK.

---

Você é um engenheiro de software sênior. O **Vital8** (este repositório) é o ERP B2B multi-tenant. Existe um produto irmão, **Doctor8** (repositório em `C:\Users\diego\Documents\doctor8`), plataforma/marketplace de saúde já em produção, com integrações reais e testadas que o Vital8 hoje só tem como mock ou como implementação recém-criada na Fase 16.

**Sua missão:** portar o código de integração comprovado do Doctor8 para dentro dos adapters do Vital8, adaptando ao padrão arquitetural do Vital8. O Doctor8 é **somente leitura** — nunca modifique nada lá; apenas leia, copie e adapte.

## REGRAS DE ADAPTAÇÃO (invioláveis)

1. **Nada entra fora de adapter.** Todo código portado vive em `src/lib/integrations/<nome>/` implementando a interface já existente do Vital8. O mock continua sendo o default em dev; o provider real ativa por env var. O sistema segue rodando 100% sem chaves.
2. **Adaptar, não transplantar.** O Doctor8 é single-product com padrões próprios. Ao portar: remover lógica de marketplace/multi-região (US/EU) que não se aplica; injetar `organizationId` e usar `createTenantClient`; trocar criptografia pelo `phi.ts` do Vital8; registrar eventos no `audit.service.ts` do Vital8; validar entrada com Zod.
3. **Sem dependência cruzada.** O Vital8 nunca importa do repositório Doctor8 em runtime. O código é copiado e passa a pertencer ao Vital8 (adicionar as libs npm necessárias ao package.json do Vital8).
4. **Se a Fase 16 já criou um provider real equivalente**, compare com o do Doctor8 e mantenha o melhor dos dois — critério: cobertura de casos de erro, retry/idempotência e maturidade (o do Doctor8 está em produção; em caso de empate, prefira-o).
5. Qualidade padrão do repo: `tsc --noEmit` limpo, build verde, testes unitários dos providers (com HTTP mockado), migrations incrementais, docs atualizadas.
6. Uma etapa por vez; ao fim de cada uma, checklist de verificação manual e **pare aguardando meu OK**.

## MAPA DE PORTABILIDADE (origem no Doctor8 → destino no Vital8)

### ETAPA 17A — Assinatura digital ICP-Brasil (Lacuna)
- **Origem:** `src/lib/lacuna.ts`, `lacuna-errors.ts`, `digital-sign-session.ts`, `digital-sign-test-pdf.ts`, `employer-document-icp.ts`
- **Destino:** provider `lacuna` em `src/lib/integrations/digital-signature/`
- Env: `LACUNA_API_KEY`, `LACUNA_ENDPOINT`, `LACUNA_SECURITY_CONTEXT`
- Conectar aos pontos de assinatura do Vital8: fechamento de `Encounter`, `Prescription`, `MedicalCertificate`. PDF assinado no storage + hash na auditoria.

### ETAPA 17B — WhatsApp Cloud API (Meta)
- **Origem:** `src/lib/whatsapp.ts`, `whatsapp-webhook.ts`, `whatsapp-i18n.ts`, `wa-phone.ts` + model `WhatsAppDeliveryLog`
- **Destino:** provider `whatsapp-cloud` em `src/lib/integrations/messaging/`
- Env: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_REMINDER_TEMPLATE`, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_DEFAULT_COUNTRY_CODE`
- Model de log de entrega no Vital8 (com `organizationId`); webhook de status/resposta em `src/app/api/webhooks/whatsapp/`; ligar às réguas existentes (confirmação, lembrete, NPS, cobrança) e ao opt-out.
- Atenção: templates aprovados por conta Meta — configuração por organização (número/token próprios por org OU número da plataforma; decidir e documentar em `DECISOES.md`).

### ETAPA 17C — Pagamentos (Stripe)
- **Origem:** `src/lib/stripe.ts`, `stripe-connect.ts`, `stripe-payment-methods.ts`, `stripe-refund.ts`, `stripe-subscription-checkout.ts` + model `ProcessedStripeEvent`
- **Destino:** dois usos distintos:
  1. **Billing SaaS do Vital8** (assinatura das clínicas): substituir o checkout mock de `/app/assinatura` por Stripe subscription checkout + webhook idempotente (`ProcessedStripeEvent` vira model do Vital8).
  2. **Provider `stripe`** em `src/lib/integrations/payments/` (cobrança de pacientes: link de pagamento, PIX quando disponível, refund) — conciliar `Payment`/`Receivable` via webhook.
- Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Não portar Stripe Connect/split do marketplace (não se aplica ao ERP) — anotar como possível fase futura para repasse a profissionais.

### ETAPA 17D — Teleconsulta (Daily.co)
- **Origem:** `src/lib/daily.ts`, `daily-recording-log.ts`, `meeting-rooms.ts`, `consult-session.ts` (ler também `ConsultVideoIncident`, `DailyRecordingLog` no schema)
- **Destino:** provider `daily` em `src/lib/integrations/video/`
- Sala criada ao iniciar teleconsulta, token efêmero por participante, log de gravação/incidentes com consentimento (CFM 2.314/2022) anexado ao `Encounter`. Manter o provider de link externo como fallback.

### ETAPA 17E — IA clínica (transcrição e notas)
- **Origem:** `src/lib/ai-transcribe.ts`, `ai-consult-notes.ts`, `ai-chart-chat.ts`, `ai-summarize.ts`, `src/lib/voice-assistant/`
- **Destino:** providers reais no adapter `llm` do Vital8, consumidos pelo módulo `ai` existente (respeitando `AiSettings`, `AiDataProcessingConsent`, `AiInteractionLog`, `AiUsageMonthly`)
- Env: `OPENAI_API_KEY` e/ou `ANTHROPIC_API_KEY`
- Se a Fase 16G criou scribe/copiloto com mock, esta etapa só troca o motor — a UX e o fluxo de consentimento não mudam.

### ETAPA 17F — TISS: aproveitar a base 4.01 do Doctor8
- **Origem:** `src/lib/tiss-export.ts`, `tiss-validate.ts` (versão 4.01) + models `TissGuide`/`TissBatch` do Doctor8 para comparação de campos
- **Destino:** `src/lib/tiss/` do Vital8 (estrutura multi-versão da Fase 16B)
- Usar o mapeamento 4.01 como referência para revisar/completar a implementação 4.03 da Fase 16B (diff de campos 4.01→4.03 documentado em `docs/tiss.md`). Não regredir nada que a 16B já entregou.

### ETAPA 17G — Infra de apoio (menor prioridade)
- **Storage S3:** `src/lib/s3.ts` (+ presigner) → provider `s3` no adapter `storage` (documentos de pacientes, PDFs assinados). Env: `AWS_*`.
- **E-mail (Resend):** `email-core.ts`/`email.ts` → provider real no adapter de e-mail. Env: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`.
- **SMS (AWS SNS):** `sms-sns.ts`, `sms-otp.ts` → provider `sns` no adapter messaging (canal SMS para confirmação e OTP do portal).
- **Google Calendar:** `google-calendar-oauth.ts`, `google-calendar-sync.ts` → novo adapter `calendar` (sync bidirecional da agenda do profissional). Novidade funcional — criar model de vínculo OAuth por profissional com tokens criptografados via `phi.ts`.
- **Receita Saúde:** `psychology-receita-saude.ts` → generalizar no módulo fiscal da Fase 16C (hoje restrito a psicologia no Doctor8; no Vital8 vale para qualquer profissional PF).

## ORDEM E CRITÉRIO DE PRONTO

Ordem por impacto comercial: **17B (WhatsApp) → 17C (pagamentos) → 17A (assinatura) → 17D (vídeo) → 17E (IA) → 17F (TISS) → 17G (infra)**.

Cada etapa pronta = provider real + mock preservado + teste unitário com HTTP mockado + teste de isolamento quando houver model novo + env vars documentadas em `.env.example` + `docs/integracoes.md` atualizado + página `/app/configuracoes/integracoes` refletindo status real do provider.

Comece pela **ETAPA 17B**, apresentando primeiro: (1) diff entre o provider da Fase 16 (se existir) e o do Doctor8, (2) qual você vai manter e por quê, (3) lista de arquivos a criar/alterar.
