# Vital8 — Changelog

## Fase 17G — Infra Doctor8 (2026-07-13)

- `S3StorageAdapter` — upload/download/delete + URL assinada; fallback disco local
- `SnsSmsAdapter` — SMS transacional AWS; roteamento SMS≠WhatsApp no messaging
- Google Calendar OAuth + `ProfessionalCalendarLink` + sync em CONFIRMADO/CANCELADO/REMARCADO
- Receita Saúde generalizada — checklist, URLs oficiais, códigos por conselho
- Readiness infra agregado em `/app/configuracoes/integracoes`
- `docs/integracoes.md` atualizado

## Fase 17F — TISS Doctor8 → 4.03 (2026-07-13)

- `batch-validation.ts` — validação estrutural de lote (port Doctor8)
- `accounting-csv.ts` — exportação CSV contábil por lote
- Regras de guia: conselho profissional + carteirinha ou CPF
- `closeBatch()` valida lote antes de gerar XML; botão CSV no faturamento
- Readiness TISS em `/app/configuracoes/integracoes`; `docs/tiss.md` com diff 4.01→4.03

## Fase 17E — IA clínica OpenAI + Anthropic (2026-07-13)

- `OpenAiWhisperAdapter` — transcrição Scribe via Whisper (port Doctor8 `ai-transcribe.ts`)
- `CompositeLlmAdapter` — Anthropic (texto) + OpenAI (áudio); mock por função sem chaves
- Readiness em `/app/configuracoes/integracoes`; `docs/integracoes.md` atualizado

## Fase 17D — Daily.co teleconsulta (2026-07-13)

- Adapter `daily` em `src/lib/integrations/video/` — salas privadas + tokens (port Doctor8)
- Fallback Jitsi sem `DAILY_API_KEY`; gravação opcional (`DAILY_CLOUD_RECORDING`)
- `DailyRecordingLog`, `TeleconsultVideoIncident` multi-tenant
- Webhook `POST /api/webhooks/daily`; join `GET /api/teleconsult/[encounterId]/video`
- Painel teleconsulta no workspace do encounter; status em `/app/configuracoes/integracoes`

## Fase 17A — Lacuna ICP-Brasil (2026-07-13)

- Provider `ICP_LACUNA` — Signature Session redirect (port Doctor8)
- Callback PAdES → storage + `SignedClinicalDocument` + audit
- Encounter, Prescrição, Atestado; `LacunaSignatureSession` multi-tenant
- Teste em Configurações → Prontuário

## Fase 17C — Stripe SaaS + cobrança paciente (2026-07-13)

- Checkout subscription real em `/app/assinatura` (port Doctor8)
- Provider `stripe` em payments — link hosted checkout + conciliação Receivable
- `ProcessedStripeEvent` idempotente; webhooks billing + pagamentos
- Refund idempotente (`stripe-refund.ts`); sem Stripe Connect
- `docs/integracoes.md` atualizado

## Fase 17B — WhatsApp Cloud API (port Doctor8) (2026-07-13)

- HMAC webhook (`WHATSAPP_APP_SECRET`), raw body, log completo de status
- `WhatsAppDeliveryLog` multi-tenant + normalização E.164
- Templates por env/origem; config org (`MessagingSettings`) + fallback plataforma
- Readiness/probe em `/app/configuracoes/integracoes`
- `docs/integracoes.md`

## Fase 16G — IA clínica Scribe + Copiloto (2026-07-12)

- Ambient scribe: consentimento paciente, gravação, transcrição, SOAP campo a campo
- Copiloto: resumo automático, CID anamnese, rascunhos atestado/encaminhamento
- Detecção anomalias BI → `UserNotification` (ocupação, no-show, glosa)
- `ScribeSession`, `discardAudioAfterTranscription` em AiSettings
- `docs/ia-clinica.md`

## Fase 16F — Comunicação real (2026-07-12)

- WhatsApp Cloud API + webhook inbound (confirmar/cancelar/opt-out)
- Resend para e-mail transacional; roteamento por canal
- PIX Efí com QR dinâmico, `PatientPaymentLink` e conciliação webhook
- Central `/app/relacionamento/conversas` + IA secretária
- `docs/comunicacao-real.md`

## Fase 16E — Prescrição digital integrada (2026-07-12)

- Adapter `prescription-provider` Memed (embed + webhook) + catálogo local
- `PrescriptionSettings`, interações medicamentosas, checagem alergias
- Receita assinada (16D) com código/URL CFM e controle especial Port. 344
- Envio WhatsApp/e-mail + portal paciente com download PDF
- `docs/prescricao-digital.md`

## Fase 16D — Assinatura ICP-Brasil + SBIS/NGS2 (2026-07-12)

- Adapters ICP A1 (servidor) e DSaS (API) + mock dev
- `SignedClinicalDocument` + PAdES + auditoria `clinical.sign`
- Assinatura em encontro, receita, atestado e laudo
- Verificador público `/verificar/[codigo]` sem PHI
- `docs/sbis-ngs2.md` checklist NGS2

## Fase 16C — NFS-e Padrão Nacional + Receita Saúde (2026-07-12)

- Adapter `nfse-nacional` (DPS → NFS-e) + mock default em dev
- Models `FiscalSettings` e `FiscalDocument` com fila/retry
- Emissão automática ao quitar recebível; manual no financeiro
- Recibo Receita Saúde (PF) + exportação carnê-leão CSV
- Portal paciente: download DANFSe/recibo PDF
- CBS/IBS atrás de feature flag em settings e categorias

## Fase 16B — TISS 4.03.00 (2026-07-12)

- Strategy registry multi-versão (3.05.00 legado + 4.03.00 obrigatório)
- Builder/validator 4.03 com `componenteOrganizacional`, CNES obrigatório, tabela TUSS 22
- UI convênios: select de versão, banner regulatório jul/2026, atualização por operadora
- XSDs 3.05 e 4.03; `docs/tiss.md`; testes builder/validator ambas versões

## Fase 10 — Administração, Billing e Polimento (2026-07-12)

- Multi-unidade: `Branch`, seletor no header, backfill Unidade Principal
- Permissões finas: `PermissionProfile`, matriz visual, `can()` centralizado
- Billing SaaS: `Subscription`, checkout mock, `/app/assinatura`, `/precos`, webhook
- Onboarding wizard retomável, exportação LGPD async, `/app/sistema`
- Playwright E2E, CSP, `/api/health`, índices compostos
- Seed demo com 2 unidades

## Fase 9 — BI, Indicadores e Gestão

- DailyOrgMetrics, dashboards por papel, Recharts, metas, notificações

## Fases 1–8

- Core multi-tenant, pacientes, agenda, prontuário, financeiro, TISS, estoque, relacionamento
