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
