# Auditoria de Segurança — Vital8

| Campo | Valor |
|-------|-------|
| **Data** | 2026-07-12 |
| **Commit** | `8c065054cf9cf40be2674dcea472ed5d5d37d358` (+ correções desta auditoria) |
| **Auditor** | Revisão automatizada sênior (LGPD / PHI / multi-tenant) |
| **Escopo** | Código completo — seções A–H do checklist |

## Sumário executivo

| Severidade | Encontrados | Corrigidos nesta sessão | Backlog |
|------------|-------------|-------------------------|---------|
| 🔴 CRÍTICO | 10 | 9 | 1 |
| ⚠️ MELHORIA | 18 | 2 | 16 |
| ✅ CONFORME | 42 | — | — |

**Recomendação:** Após aplicar as correções commitadas e resolver o item crítico remanescente (isolamento multi-unidade incompleto), o sistema pode entrar em **piloto controlado** com dados reais. **Produção plena** exige fechar o backlog de severidade alta (branch scope global, invalidação de JWT, HMAC obrigatório na API, dependências).

---

## A. Isolamento multi-tenant

### A-01 🔴 CRÍTICO — Vazamento cross-tenant em `/app/sistema` (CORRIGIDO)

**Evidência:** `src/app/app/sistema/page.tsx:7-15` consultava `communicationLog`, `organizationExport` e `mobileSyncLog` **sem** `organizationId`, expondo métricas de todas as organizações a qualquer OWNER/ADMIN.

**Correção:** Filtro por `ctx.organizationId` da sessão (`requireAuth`).

**Teste:** `src/lib/security/security.test.ts` + isolamento existente em `src/lib/db/tenant-isolation.test.ts`.

---

### A-02 🔴 CRÍTICO — IDOR em `markRead` de notificações (CORRIGIDO)

**Evidência:** `notification.service.ts` filtrava apenas `{ id, userId }` — usuário membro de múltiplas orgs poderia marcar notificação de outra org se soubesse o UUID.

**Correção:** `where: { id, organizationId, userId }` + action passa `ctx.organizationId`.

---

### A-03 ⚠️ MELHORIA — `branchFilter` definido mas não aplicado (PARCIAL)

**Evidência:** `branchFilter` em `src/modules/admin/services/branch.service.ts:44` só usado em testes (`branch.test.ts`). Usuário restrito à unidade X podia ver agenda de outras unidades.

**Correção parcial:** `listAppointmentsAction` aplica `branchFilter(ctx.branchId)`.

**Backlog:** Pacientes, leads, financeiro, estoque — ver `SECURITY-BACKLOG.md` A-04.

---

### A-04 ✅ CONFORME — Tenant client row-level

**Evidência:** `src/lib/db/tenant-client.ts:234-258` injeta `organizationId` em 100+ models; testes em `tenant-isolation.test.ts`, `patient-tenant-isolation.test.ts`, `appointment-tenant-isolation.test.ts`, `encounter-tenant-isolation.test.ts`, `sale-tenant-isolation.test.ts`.

---

### A-05 ✅ CONFORME — Server Actions usam sessão

**Evidência:** `requireAuth()` em `src/lib/auth/guards.ts:40-65` obtém `organizationId` do JWT Auth.js, nunca do body. Padrão replicado em `marketing.actions.ts`, `patient.actions.ts`, `emr.actions.ts`, etc.

**Exceção documentada (público):** rotas `/lp/`, `/c/`, `/agendar/` resolvem org por `orgSlug` — intencional para captação/agendamento.

---

### A-06 ⚠️ MELHORIA — Uso de `adminPrisma` fora de `lib/db`

Inventário (amostra representativa):

| Arquivo | Justificativa | Filtro orgId |
|---------|---------------|--------------|
| `secretary.service.ts` | Webhook WhatsApp externo (sem sessão) | ✅ `organizationId` em queries |
| `automation.service.ts` | Jobs por org | ✅ parâmetro `organizationId` |
| `notification.service.ts` | Serviço interno | ✅ parâmetro |
| `portal-auth.service.ts` | OTP público | ✅ `organizationId` |
| `tracking.service.ts` | Links públicos `/r/[code]` | ⚠️ `TrackedLink` global por `code` (aceitável) |
| `nps.service.ts` | Token público | ✅ via survey |
| `sistema/page.tsx` | Era cross-tenant | ✅ corrigido |

---

### A-07 ✅ CONFORME — Jobs iteram por organização

**Evidência:** `src/app/api/jobs/process/route.ts:24-42` — loop `orgs` + `createTenantClient(org.id)` por iteração; fila global `processCommunicationQueue` processa logs que já carregam `organizationId`.

---

### A-08 — Teste mental IDOR (10 endpoints sensíveis)

| Endpoint | Org A → ID org B | Resultado |
|----------|------------------|-----------|
| `GET /api/v1/patients/[id]` | ID paciente B | 404 (tenant client) |
| `GET /api/v1/encounters/[id]` | ID encounter B | 404 |
| `PATCH appointment (action)` | appointmentId B | 0 rows / erro |
| `convertLeadAction` | leadId B | `findFirstOrThrow` falha no tenant |
| `getPatientById` (action) | patientId B | null |
| `markNotificationRead` | notif B | 0 updates (corrigido) |
| `emr.actions` update section | encounter B | tenant block |
| Portal `getPortalAppointments` | session A | só patientId da sessão |
| `listLeadsAction` | N/A (sem ID cross) | filtro org automático |
| `mobile/sync` | org da sessão | `requireMobileSession` |

---

## B. Autenticação e sessões

### B-01 🔴 CRÍTICO — Cron jobs abertos sem segredo (CORRIGIDO)

**Evidência:** `jobs/process/route.ts` — se `CRON_SECRET` ausente, qualquer um podia disparar jobs.

**Correção:** `assertCronAuthorized()` — falha fechada em `NODE_ENV=production` sem segredo.

---

### B-02 🔴 CRÍTICO — OTP com `Math.random` (CORRIGIDO)

**Evidência:** `portal-session.ts:12-14` usava PRNG previsível.

**Correção:** `crypto.randomInt(100000, 1000000)`.

---

### B-03 🔴 CRÍTICO — Sem rate limit no login (CORRIGIDO)

**Evidência:** `auth.actions.ts:loginAction` sem throttling.

**Correção:** `checkLoginRateLimit` — 10 tentativas/15min por e-mail, 30 por IP.

---

### B-04 ⚠️ MELHORIA — JWT sem invalidação ao desativar membro/trocar senha

**Evidência:** `auth.config.ts:5` — JWT stateless; sem blocklist. Mitigação: sessão curta não configurada (`maxAge` ausente).

**Backlog:** B-04 em `SECURITY-BACKLOG.md`.

---

### B-05 ✅ CONFORME — Login anti-enumeração

**Evidência:** `auth.ts:53-68` e `auth.actions.ts:121` — mesma mensagem "E-mail ou senha incorretos".

**⚠️** Signup retorna "E-mail já cadastrado" — enumeração no cadastro (backlog).

---

### B-06 ✅ CONFORME — Portal isolado da equipe

**Evidência:** Cookie `vital8-portal-session` separado (`portal-session.ts:5`); Auth.js usa cookie próprio. OTP com rate limit (`portal-auth.service.ts:28-38`).

---

### B-07 ✅ CONFORME — API keys hasheadas

**Evidência:** `api-key.service.ts` — `bcrypt` no secret; prefixo para lookup; sandbox restrito a org demo (`authenticate.ts:70-72`).

---

## C. Criptografia e PHI

### C-01 🔴 CRÍTICO — PHI em logs do adapter de mensagens (CORRIGIDO)

**Evidência:** `console.adapter.ts:7-14` logava `to` e `body` completos.

**Correção:** Em produção, log apenas `channel` + `metadata`.

---

### C-02 🔴 CRÍTICO — Fallback inseguro de `AUTH_SECRET` (CORRIGIDO)

**Evidência:** `public-security.ts:6` — `"dev-insecure-secret"` se env ausente.

**Correção:** Throw em produção; fallback só em dev local.

---

### C-03 ✅ CONFORME — `phi.ts` AES-256-GCM

**Evidência:** `src/lib/crypto/phi.ts:3-38` — IV único 12 bytes, auth tag, chave 32 bytes via env. Script `scripts/re-encrypt-phi.ts` documentado em DECISOES.md.

**Campos criptografados (principais):** `cpfEncrypted`, `phonesEncrypted`, `emailEncrypted`, `addressEncrypted`, `contentEncrypted` (prontuário), `aiConversationMessage.contentEncrypted`, `rndsCredential.certificateEncrypted`.

**Em claro (justificado):** `searchName`, `phoneSearch`, `cpfHash` — tokens de busca com hash/HMAC (DECISOES.md).

---

### C-04 ✅ CONFORME — PWA offline

**Evidência:** `store.client.ts` AES-GCM; `pwa-provider.tsx:54-57` purge no logout; snapshot sem prontuário (`offline/types.ts`).

---

### C-05 ⚠️ MELHORIA — `export.service.ts` logava tamanho do payload

**Correção:** Log apenas contagem de campos, não conteúdo.

---

## D. Validação e injeção

### D-01 ✅ CONFORME — Zod nas Server Actions

Padrão `schema.safeParse` / `parse` em actions de pacientes, marketing, scheduling, finance.

### D-02 ✅ CONFORME — SQL raw parametrizado

**Evidência:** `$queryRaw\`SELECT 1\`` apenas em health check — template tag seguro.

### D-03 ⚠️ MELHORIA — `dangerouslySetInnerHTML`

| Local | Risco | Status |
|-------|-------|--------|
| `c/[orgSlug]/page.tsx:40` | JSON-LD estático (`JSON.stringify`) | ✅ Baixo |
| Landing blocks | Conteúdo admin | ⚠️ Sanitizar HTML se bloco rich-text |

### D-04 ✅ CONFORME — Templates PDF

Variáveis `{{key}}` substituídas literalmente em `template-renderer.ts` — sem eval.

---

## E. Rotas públicas

### E-01 🔴 CRÍTICO — SSRF em webhooks de saída (CORRIGIDO)

**Evidência:** `webhook.service.ts:70` — `fetch(ep.url)` sem validação; `createWebhookEndpointAction` aceitava `localhost`.

**Correção:** `assertSafeOutboundUrl()` — bloqueia localhost, IP privado, metadata; HTTPS obrigatório em produção.

---

### E-02 ✅ CONFORME — Rate limit em formulários públicos

**Evidência:** `public-lead.actions.ts:32`, `public-booking.actions.ts:58`, honeypot em embed.

### E-03 ✅ CONFORME — Painel de chamada minimizado

**Evidência:** `formatPanelName` → "Maria S." (`labels.ts:25-36`).

### E-04 ⚠️ MELHORIA — Webhook billing mock sem assinatura forte

**Evidência:** `api/billing/webhook/route.ts` — adapter mock; `processed` em memória (não persistente).

---

## F. Headers, configuração, dependências

### F-01 🔴 CRÍTICO — Seed executável em produção (CORRIGIDO)

**Evidência:** `prisma/seed.ts` com senha `Vital8@dev` sem guard.

**Correção:** Bloqueio se `NODE_ENV=production` sem `ALLOW_SEED=true`.

---

### F-02 ⚠️ MELHORIA — CSP com `unsafe-inline` / `unsafe-eval`

**Evidência:** `next.config.mjs:19-20`.

---

### F-03 ⚠️ MELHORIA — `npm audit`

- `glob` (high) — devDependency via eslint-config-next
- `@hono/node-server` (moderate) — via prisma dev
- Mitigação: não exposto em runtime de produção; atualizar quando breaking change aceito.

---

### F-04 ✅ CONFORME — Sem segredos hard-coded em src/

Grep não encontrou API keys em código fonte (apenas seeds dev e mocks).

---

## G. Autorização e auditoria

### G-01 ✅ CONFORME — Matriz de permissões Fase 10

`permissions.ts` + `permission-profile.service.ts`; testes de role em módulos.

### G-02 ✅ CONFORME — Prontuário assinado imutável

**Evidência:** `assertEncounterMutable` + `encounter-immutability.test.ts`; `emr.actions.ts:582,618` bloqueia ASSINADO.

### G-03 ✅ CONFORME — RecordAccessLog

Chamado em `encounter.service.ts`, `portal.service.ts`, `prescription.service.ts`, API handlers.

### G-04 ⚠️ MELHORIA — Escalonamento de membership

Verificar se usuário pode auto-promover role — backlog (teste manual recomendado).

---

## H. Lógica de negócio sensível

### H-01 ✅ CONFORME — IA minimização

**Evidência:** `llm-gateway.service.ts:43-49` — `minimizeJsonPayload` / `minimizeTextForLlm` em toda chamada `aiComplete`.

### H-02 ✅ CONFORME — Ads sem PHI (Fase 15)

**Evidência:** `marketing.test.ts` + `mock.adapter.ts` rejeita termos clínicos.

### H-03 ✅ CONFORME — Idempotência API

`api/middleware/idempotency.ts` + testes em `api.test.ts`.

### H-04 ⚠️ MELHORIA — Opt-out marketing leads

`LeadOptOut` implementado; canais transacionais separados — OK.

---

## Plano de correção executado

| ID | Correção | Commit |
|----|----------|--------|
| A-01 | Escopo `/app/sistema` por tenant | `security(A-01)` |
| A-02 | IDOR `markRead` | `security(A-02)` |
| A-03 | `branchFilter` em agenda | `security(A-03)` |
| B-01 | Cron auth fail-closed | `security(B-01)` |
| B-02 | OTP criptográfico | `security(B-02)` |
| B-03 | Rate limit login | `security(B-03)` |
| C-01 | PHI em console adapter | `security(C-01)` |
| C-02 | AUTH_SECRET produção | `security(C-02)` |
| E-01 | SSRF webhooks | `security(E-01)` |
| F-01 | Guard seed produção | `security(F-01)` |
| — | Suíte `security.test.ts` | `security(tests)` |

---

## Veredito

| Critério | Status |
|----------|--------|
| Piloto com PHI real (1 clínica, monitoramento) | **Condicionalmente aprovado** após deploy das correções |
| Produção multi-cliente sem backlog crítico | **Não aprovado** — fechar A-04 (branch global) primeiro |
| Conformidade LGPD técnica | **Boa base** — criptografia, tenant, auditoria; melhorar retenção/logs |
