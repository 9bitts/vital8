# Decisões arquiteturais — Vital8

Registro de decisões tomadas na Fase 1 quando há trade-offs ou dependências de fases futuras.

## Multi-tenancy

**Decisão:** Banco compartilhado, schema compartilhado, isolamento por `organizationId` via Prisma Client Extension.

**Alternativa descartada:** Schema por tenant (complexidade operacional alta para MVP).

**Reversibilidade:** Migração futura para schema dedicado por tenant grande (Enterprise) permanece possível exportando por `organizationId`.

## Organization fora do tenant client

**Decisão:** `Organization` e `User` são acessados via `admin-client.ts` com verificação explícita de permissão na server action (`where: { id: session.organizationId }`).

**Motivo:** Organization não possui `organizationId` — é a entidade raiz do tenant.

## Convites sem e-mail transacional

**Decisão:** Fase 1 exibe o link do convite na UI após criação (copiar manualmente). Envio por e-mail fica para integração futura.

**Motivo:** Prompt proíbe serviços externos nesta fase.

## AuditLog via admin client na listagem

**Decisão:** `listAuditLogs` usa `adminPrisma` com filtro explícito `organizationId`, protegido por `requireAuth(["OWNER", "ADMIN"])`.

**Motivo:** Serviço compartilhado entre auth (sem tenant context) e área autenticada; filtro duplo (guard + query) garante isolamento.

## Prisma 7 com driver adapter PostgreSQL

**Decisão:** Usar `@prisma/adapter-pg` + `pg` (obrigatório no Prisma 7).

**Motivo:** Prisma 7 exige adapter explícito; `DATABASE_URL` deve ser `postgresql://` (não `prisma+postgres://`).

**Arquivo:** `src/lib/db/create-prisma.ts` centraliza instanciação.

## JWT sem refresh de membership em cada request

**Decisão:** Role e organizationId vêm do JWT; troca de org atualiza via `session.update()`.

**Reversibilidade:** Fase futura pode invalidar sessão ao desativar membro (webhook/job ou check no middleware).

## Soft delete

**Decisão:** `deletedAt: null` injetado automaticamente no tenant client apenas para models com soft delete (`Membership` nesta fase).

**Motivo:** `Invitation` e `AuditLog` não possuem soft delete no schema da Fase 1.

**Atualização Fase 2:** Todos os models de paciente possuem soft delete e estão registrados em `MODELS_WITH_SOFT_DELETE`.

## Campos PHI e busca (Fase 2)

**Decisão:** CPF, RG, telefones, e-mail, endereço e observações clínicas são criptografados com AES-256-GCM (`phi.ts`). Campos derivados em claro para busca:

- `searchName` — nome normalizado (sem acentos, minúsculas)
- `cpfHash` — HMAC-SHA256 do CPF normalizado com `CPF_HASH_KEY` dedicada, escopado por `organizationId` (formato `{orgId}:{cpf}`)
- `phoneSearch` — dígitos do telefone principal (busca parcial)
- `cardNumberSearch` — últimos 6 dígitos da carteirinha

**Trade-off:** Telefone e carteirinha parcialmente indexáveis em claro para performance de busca na recepção. CPF nunca fica em claro no banco; hash usa chave dedicada separada de `PHI_ENCRYPTION_KEY`.

## ViaCEP (Fase 2)

**Decisão:** Busca de endereço via `ViaCepAdapter` (API pública gratuita) com fallback manual nos campos.

**Motivo:** UX de cadastro; serviço externo não obrigatório — usuário pode preencher manualmente se offline.

## Permissões aba Saúde (Fase 2)

**Decisão:** Aba Saúde e mutações clínicas (alergias, condições, medicamentos) restritas a `OWNER`, `ADMIN`, `PROFISSIONAL_SAUDE`. `RECEPCAO` e `FINANCEIRO` não acessam.

## Anonimização LGPD (Fase 2)

**Decisão:** Confirmação dupla na UI (nome completo + digitar `ANONIMIZAR`); apenas `OWNER`/`ADMIN`.

**Reversibilidade:** Busca full-text cifrada (ex.: envelope encryption + blind index) pode substituir campos derivados se política de segurança exigir.

## Upload de documentos (Fase 2)

**Decisão:** Adapter `LocalStorageAdapter` grava em `uploads/{orgId}/{patientId}/`. Produção: trocar por S3/R2 via mesma interface em `src/lib/integrations/storage/`.

**Motivo:** Prompt proíbe serviços pagos obrigatórios; filesystem local funciona 100% em dev.

## Anonimização LGPD vs delete físico

**Decisão:** Direito de eliminação implementado como anonimização (`anonymizedAt` + mascaramento PHI + soft delete), preservando trilha de auditoria e integridade referencial para fases futuras (agenda, prontuário).

## Painel de chamada — tempo real (Fase 3)

**Decisão:** Polling HTTP a cada 5 segundos via `/api/painel/[orgSlug]`.

**Motivo:** Simplicidade para TV na sala de espera; SSE/WebSocket reservado para fase posterior.

**Privacidade:** Apenas primeiro nome + inicial do sobrenome (nome social prioritário) e sala.

## Confirmação de consulta (Fase 3)

**Decisão:** Link público `/confirmar/[token]`; adapter de mensageria com `ConsoleMessagingAdapter` em dev.

## Máquina de estados e conflitos (Fase 3)

**Decisão:** Transições em `appointment-state.service.ts`; conflitos por profissional/paciente/sala; encaixe só ADMIN/OWNER; slots = grade − exceções − feriados − ocupados.

## Permissões agenda (Fase 3)

**Decisão:** RECEPCAO gerencia agenda/fila; configurações e encaixe: OWNER/ADMIN; limite de espera em `Organization.settings`.

## Imutabilidade do PEP (Fase 4 — SBIS/NGS2)

**Decisão:** `Encounter` com status `ASSINADO` é imutável. `contentHash` SHA-256 do conteúdo canônico serializado na assinatura. Correções via `EncounterAmendment` (conteúdo criptografado). Update/delete bloqueados no service + testes.

**Assinatura:** Adapter `DevSimpleSignatureAdapter` (usuário + hash + timestamp). Interface pronta para ICP-Brasil.

## Criptografia vs metadados clínicos (Fase 4)

**Decisão:** Texto livre clínico (`EncounterSection.contentEncrypted`, adendos, notas) via `phi.ts`. CID-10 (`Cid10Code`), códigos em `structuredData` e metadados (datas, status, tipo) permanecem em claro para relatórios epidemiológicos futuros.

## RecordAccessLog (Fase 4)

**Decisão:** Toda leitura de Encounter/Prescription/ExamResult registra `RecordAccessLog` (usuário, IP, timestamp). Aba Acessos na ficha do paciente para OWNER/ADMIN.

## Registro reservado psicologia (Fase 4)

**Decisão:** Seções `restrictedToAuthor` visíveis apenas ao autor. OWNER/ADMIN veem existência mas não conteúdo — nem override administrativo.

## Permissões PEP (Fase 4)

**Decisão:** Conteúdo clínico: PROFISSIONAL_SAUDE, ADMIN/OWNER (configurável). RECEPCAO: metadados/datas only. FINANCEIRO: bloqueio total. Assinar: apenas autor.

## Feature flags por plano

**Decisão:** `features.service.ts` mapeia `Plan` (TRIAL/STARTER/PRO/ENTERPRISE) para módulos habilitados. Fase 2 registra flags; enforcement completo nas fases avançadas (TISS, BI, telemedicina).

## Mesclagem de duplicados

**Decisão:** Registro secundário recebe soft delete + nota criptografada com referência ao primário; relacionamentos são reparentados. Sem delete físico.

**Motivo:** Auditoria e conformidade SBIS/CFM (imutabilidade de trilha).

## Centavos inteiros (Fase 5)

**Decisão:** Todo valor monetário persistido em centavos (`Int`). Formatação BRL apenas na UI via `src/lib/money.ts`. `Service.privatePrice` (Decimal legado da agenda) convertido na tabela de preços do seed.

## Fluxo checkout (Fase 5)

**Decisão:** `Appointment.saleId` evita cobrança dupla. FINALIZADO → checkout na recepção → `Sale` CONFIRMADA → `Receivable`(s) → `Payment` no caixa aberto. Pacote debita sessão via `PackageSessionConsumption` no checkout/atendimento.

## Comissão e estorno (Fase 5)

**Decisão:** Regras por profissional (percentual em basis points ou fixo); base FATURADO ou RECEBIDO. Fechamento trava `CommissionStatement`. Estorno exige OWNER/ADMIN, motivo obrigatório, reabre recebível e lança saída no caixa se dinheiro.

## Adapters financeiros (Fase 5)

**Decisão:** `nfse/` mock (numeração sequencial + PDF texto) e `payments/` mock (link PIX + página `/pagamento/[linkId]`). Interfaces prontas para eNotas/Focus e gateway real.

## Auditoria financeira (Fase 5)

**Decisão:** Toda mutação via `createAuditLog` (`sale.checkout`, `cash.open/close`, `payment.register`, `payment.refund`, etc.).

## Versão TISS adotada (Fase 6)

**Decisão:** Versão padrão **3.05.00** (configurável por operadora em `HealthInsurer.tissVersion`). XML gerado com namespace `http://www.ans.gov.br/padroes/tiss/schemas`, epílogo `<hash>` MD5 do conteúdo pré-epílogo. Operadoras seed usam 3.05.00 (Unimed) e 4.01.00 (Amil) para demonstrar multi-versão.

## Estratégia de schemas XSD (Fase 6)

**Decisão:** XSDs de referência em `src/lib/tiss/schemas/` (subset estrutural 3.05.00). Validação em runtime via `validateTissXmlStructure` + `validateGuideFields` (campo a campo na UI). Parser XSD completo não incluído no bundle — atualização: substituir/adicionar arquivo XSD por versão e estender validador estrutural; CI valida XML de lote nos testes unitários.

## Numeração e conciliação TISS (Fase 6)

**Decisão:** Sequenciais por `organizationId + healthInsurerId` em `TissSequence` com transação `Serializable`. Lote fechado gera `Receivable` (`origin: TISS_BATCH`); demonstrativo cria `Payment` + `GlosaItem`; convênio é devedor via `healthInsurerId` no recebível.

## Adapters TISS (Fase 6)

**Decisão:** `tiss-transport/` mock para envio webservice; XML persistido via `StorageAdapter` existente. Feature flag `tiss` em planos PRO e ENTERPRISE.

## Saldo derivado de movimentos (Fase 7)

**Decisão:** Saldo nunca editado diretamente. `StockBalance` é agregado materializado atualizado na mesma transação `Serializable` que cria `StockMovement`. Consistência validada por `updateMany` com `quantity >= saída` (bloqueio de negativo).

## Estoque negativo (Fase 7)

**Decisão:** Bloqueado por padrão via `Organization.settings.inventory.allowNegativeStock`. Quando permitido, saída excedente registrada com alerta na dashboard — decisão consciente do administrador.

## FEFO e custo médio (Fase 7)

**Decisão:** Consumo automático (kits) usa FEFO por `StockBatch.expiryDate`. Custo médio móvel recalculado a cada entrada; saídas registram `unitCostCents` do produto no momento do consumo.

## Controlados Portaria 344 (Fase 7)

**Decisão:** `Product.isControlled` + `controlledList` (A/B/C). Movimentos exigem lote; sem delete físico — estorno via movimento `ESTORNO` (contra-movimento). Livro de controlados em `/app/estoque/relatorios`.

## Perfil ESTOQUE (Fase 7)

**Decisão:** Role `ESTOQUE` no enum + permissões em `inventory/lib/permissions.ts`. RECEPCAO somente consulta; ajustes de inventário/perdas: ADMIN/OWNER/ESTOQUE.

## Fila de comunicação e cron (Fase 8)

**Decisão:** `CommunicationLog` com status `FILA` processado por `/api/jobs/process` (idempotente via `updateMany` claim + `idempotencyKey` unique). Vercel Cron a cada 15 min; botão manual em dev. Sem worker externo.

## Fuso horário (Fase 8)

**Decisão:** Réguas H-48/H-24 calculadas sobre `appointment.startsAt` (UTC no banco) com formatação `America/Sao_Paulo` para mensagens. Offset negativo = antes do evento.

## Segurança rotas públicas (Fase 8)

**Decisão:** Sessão portal isolada (`vital8-portal-session`, hash no banco). OTP 6 dígitos, 10 min, 5 tentativas. Rate limit in-memory por IP/telefone. Headers `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` nas rotas `/agendar`, `/portal`, `/nps`, `/teleconsulta`. Arquivos clínicos só via token assinado com expiração. `RecordAccessLog` com `PATIENT_PORTAL` para acessos do portal.

## Telemedicina CFM 2.314 (Fase 8)

**Decisão:** `TeleconsultConsent` obrigatório antes de `TeleconsultRoom`. Adapter `video` com Jitsi em dev; interface pronta para provedor com gravação. Encounter registra modalidade, horários de entrada e consentimento vinculado.

## Camada analítica (Fase 9)

**Decisão:** Tabelas `DailyOrgMetrics` e `DailyProfessionalMetrics` recalculadas pelo `/api/jobs/process` (últimos 7 dias, idempotente via upsert). Drill-down usa queries diretas com `Promise.all`. Índices: `(organizationId, date)` unique e `(professionalId, date)`.

## Performance dashboards (Fase 9)

**Decisão:** Páginas com `revalidate = 60`. Agregados pré-calculados evitam N+1. Meta: < 2s no seed. Recharts com tabela alternativa e export CSV client-side.

## Multi-unidade (Fase 10)

**Decisão:** Paciente e prontuário pertencem à **Organization** (compartilhados entre filiais). Operações (agenda, caixa, estoque, TISS) têm `branchId` opcional. BI suporta consolidado (sem filtro) ou por unidade. Backfill: "Unidade Principal" por org.

## Permissões finas (Fase 10)

**Decisão:** `PermissionProfile` com matriz JSON recurso×ação sobrepondo papel base (`DEFAULT_PROFILES`). Verificação centralizada via `can()` / `requirePermission()` em `guards.ts`.

## Billing SaaS (Fase 10)

**Decisão:** `Subscription` desacoplada de `Organization.plan` (mapeamento BASICO→STARTER). Adapter mock em dev (`/checkout/mock`); interface Stripe-ready. Inadimplência: grace period 7 dias → somente leitura.

## API pública v1 (Fase 11)

**Versionamento:** URL `/api/v1/*`. Mudanças breaking exigem `/api/v2`. Contrato v1 congelado após release.

**OpenAPI:** Spec gerada manualmente a partir dos DTOs Zod em `src/modules/api/lib/openapi.ts` (sem dependência `zod-to-openapi` no MVP — schemas Zod validam runtime; OpenAPI documenta contrato estável). Portal Scalar em `/app/desenvolvedores`.

**Autenticação:** `Authorization: Bearer {keyPrefix}.{secret}`; HMAC opcional `X-Vital8-Signature` em escritas.

**Escopos clínicos:** `encounters:read` retorna metadados sempre; seções descriptografadas somente com `clinicalAccessEnabled` no `ApiClient`, habilitado exclusivamente por `OWNER` com justificativa auditada (LGPD).

**Feature flags:** `public_api` em PRO/ENTERPRISE; `webhooks` em ENTERPRISE.

**SANDBOX:** Keys `vk_test_*` restritas à org demo (`clinica-vida-plena`).

**Idempotência:** `Idempotency-Key` obrigatório em POST criadores; TTL 24h via `ApiIdempotencyRecord`.

**Webhooks:** Payload mínimo sem PHI; consumidor busca detalhe pela API. Entrega via job processor com backoff e DLQ.

## IA aplicada (Fase 12)

**Princípio:** IA sugere, humano decide — nenhuma ação clínica, financeira ou de comunicação executada sem revisão humana.

**Provider:** Adapter `getLlmAdapter()` — mock determinístico sem `ANTHROPIC_API_KEY`; Anthropic Messages API como referência em produção.

**Minimização:** Pipeline `minimize-payload.ts` remove CPF, telefone, e-mail e pseudonimiza nomes antes de chamadas externas.

**Consentimento:** `AiDataProcessingConsent` por recurso (`AiResourceType`), habilitado por OWNER com versão de termo. Recursos clínicos exigem consentimento ativo.

**Logs:** `AiInteractionLog.payloadEncrypted` via `phi.ts` — sem PHI em claro. Outcome `ACCEPTED|EDITED|REJECTED` mede utilidade.

**Feature flag:** `ai` exclusivo ENTERPRISE (add-on futuro documentado como extensão).

**Posição regulatória:** Apoio à decisão clínica (CFM) — conteúdo IA nunca gravado automaticamente no prontuário; rodapé de revisão profissional obrigatório na UI.

## Interoperabilidade FHIR / RNDS / Laboratórios (Fase 13)

**Padrão:** HL7 FHIR R4 com perfis publicados pela RNDS onde disponíveis.

**Identificadores BR (URLs canônicas):**
- CPF: `http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf`
- CNS: `http://rnds.saude.gov.br/fhir/r4/NamingSystem/cns`
- CNES: `http://rnds.saude.gov.br/fhir/r4/NamingSystem/cnes`
- CID-10: `http://www.saude.gov.br/fhir/r4/CodeSystem/BRCID10`
- TUSS: `http://www.saude.gov.br/fhir/r4/CodeSystem/BRTabelaTUSS`

**PHI:** Campo `Patient.cnsEncrypted` via `phi.ts` (mesmo padrão CPF). Certificado A1 RNDS em `RndsCredential.certificateEncrypted`.

**Certificado A3:** Apenas referência (`certificateReference`) — assinatura em token físico; Vital8 não armazena chave privada.

**Adapter RNDS:** Mock fiel em dev (`MockRndsAdapter`) simula `POST /token` (TTL 15 min), protocolos, `OperationOutcome` e rejeições. Interface `RndsAdapter` pronta para mTLS com certificado real.

**API FHIR:** `GET /api/v1/fhir/{resource}` com escopos existentes mapeados por recurso + flag `interoperability` (ENTERPRISE). Suporte `_lastUpdated` para sincronização incremental.

**RNDS envio:** `RndsSubmission` com fila/retry/DLQ no job processor (mesmo padrão webhooks). RAC gerado de `Encounter` `ASSINADO`; resultado de `ExamResult`.

**Laboratórios:** Adapter genérico; entrada via `POST /api/v1/inbound/lab-results` (escopo `lab:inbound`) + polling opcional. Conciliação por `ServiceRequest/{id}`; fila manual quando ambíguo.

**Feature flag:** `interoperability` exclusivo ENTERPRISE.

**Guia operacional:** `docs/rnds.md` — separa automação Vital8 vs burocracia DATASUS.

## PWA Mobile do Profissional (Fase 14)

**Service Worker:** Serwist (`@serwist/next`) — sucessor do `next-pwa`, compatível com App Router. `src/sw.ts` compilado para `public/sw.js` no build de produção (`disable` em `development`).

**Política de cache por sensibilidade:**

| Classe | Estratégia | Exemplos |
|--------|------------|----------|
| Estáticos / shell | Precache + stale-while-revalidate | JS, CSS, ícones, manifest |
| Operacionais | Network-first + fallback cache criptografado | `/api/mobile/sync/*`, páginas `/m/*` |
| Clínico | Network-only (nunca persistente) | `/atendimento`, `/prontuario`, `/api/v1/encounters` |
| Financeiro | Network-only | vendas, pagamentos, recebíveis |

**Cache local:** IndexedDB (`vital8-offline`) com payload AES-GCM; chave derivada via PBKDF2 de material HMAC (`/api/mobile/cache-key`) atrelado à sessão. **Logout ou expiração = purge total** (`purgeOfflineStore`).

**Offline = leitura + fila de escrita:** Snapshot agenda (7 dias atrás → 14 à frente) + metadados mínimos de pacientes (nome, convênio, alergias — **sem prontuário**). Ações enfileiradas em `OfflineActionQueue` com `Idempotency-Key` (reuso Fase 11).

**Prontuário offline:** **Não editável nesta fase.** Integridade, assinatura digital e `RecordAccessLog` exigem servidor; conteúdo clínico permanece network-only no SW e na UI mobile (`/m/atendimento` bloqueia offline).

**Conflitos:** `VERSION_MISMATCH` / `SLOT_CONFLICT` → 409; ação vai para **Pendências de sincronização** — nunca last-write-wins silencioso.

**Push:** Adapter `getPushAdapter()` — mock em dev; Web Push/VAPID em produção. Preferências `pushEnabled` + `pushCategories` no centro de notificações (Fase 9).

**Feature flag:** `pwa` em planos PRO e ENTERPRISE. Offline apenas `PROFISSIONAL_SAUDE` e `RECEPCAO`.

**Lighthouse PWA:** Meta ≥ 90 em build de produção com SW ativo (manifest completo, ícones maskable, `display: standalone`, fallback `/offline`).

## Marketing e captação (Fase 15)

**Funil:** `Lead` com status NOVO → PERDIDO; UTMs e `LeadSource` persistidos; conversão deduplica por telefone/CPF (Fase 2) e grava origem **permanentemente no Patient**.

**Consentimento:** Marketing separado do transacional (`OptOutPurpose.MARKETING`, `LeadOptOut`). Formulários públicos **rejeitam** envio sem `marketingConsent` + política de privacidade.

**Cadência:** `LeadFollowUpLog` + scanners no job processor; opt-out bloqueia envio.

**Publicidade em saúde:** Templates seed sem promessa de resultado; aviso CFM/CRO nas landings; depoimentos exigem consentimento de publicação.

**Campanhas:** `MarketingCampaign` (ROI) separado de `Campaign` (broadcast Fase 8).

**Feature flag:** `marketing` em PRO/ENTERPRISE; landing pages limitadas (3 no PRO, ilimitadas ENTERPRISE).

## Dados em plataformas de anúncio (Fase 15)

**Decisão:** Adapter `getAdsAdapter()` — mock em dev; Meta/Google em produção.

**Proibido:** PHI, CID, nomes, CPF, dados clínicos em eventos.

**Permitido:** `page_view`, `lead`, `schedule`, `attendance` com identificadores **hasheados** (SHA-256) e apenas com `consentGranted: true`.

**Teste:** `marketing.test.ts` valida ausência de termos sensíveis no payload.

## Auditoria de segurança (2026-07-12)

Relatório completo: `SECURITY-AUDIT.md` · Backlog: `SECURITY-BACKLOG.md`

**Correções críticas aplicadas:** isolamento `/app/sistema`, IDOR notificações, cron fail-closed, OTP `randomInt`, rate limit login, PHI fora de logs em produção, `AUTH_SECRET` obrigatório em prod, SSRF em webhooks, guard de seed em produção, `branchFilter` na agenda.

**Trade-offs aceitos conscientemente:**
- JWT stateless sem blocklist (mitigar com `maxAge` — backlog B-04)
- `adminPrisma` em jobs/automação com `organizationId` explícito no parâmetro
- CSP `unsafe-inline` temporário (Next.js) — backlog F-02
- Hash de busca (`cpfHash`, `phoneSearch`) não reversível mas identificável — necessário para dedup/LGPD export

**Suíte de regressão:** `src/lib/security/security.test.ts` (SSRF, cron, login limit, PHI log, markRead).

## Cadastro local — verificação de e-mail (2026-07-12)

**Decisão:** Manter login imediato após cadastro no trial; **não** bloquear credentials por `emailVerified` nem enviar e-mail transacional nesta fase.

**Motivo:** Vital8 ainda não possui serviço de e-mail (ver decisão “Convites sem e-mail transacional”); trial exige acesso imediato.

**Implementado mesmo assim:** rate-limit no signup, anti-enumeração de e-mail (resposta genérica de sucesso), validação de CNPJ com dígito verificador, unicidade de `documentNumber` entre organizações ativas, rate-limit de login no `authorize()` credentials.

**Reversibilidade:** Quando houver provedor de e-mail, adicionar token + bloqueio de login para contas com `emailVerified IS NULL`.

## SSO Doctor8 — auto-provisioning de clínica (2026-07-12)

**Decisão:** Opção A — no primeiro SSO B2B (`org_type=CLINIC`, e-mail verificado, CNPJ válido), criar User/Organization/Membership local se inexistentes; para usuário existente sem org com aquele CNPJ, provisionar apenas se `org_member_role` for OWNER ou ADMIN.

**Motivo:** Round-trip “cadastrei clínica no doctor8 → entro no vital8” sem tela de vinculação manual.
