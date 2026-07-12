# Vital8 — ERP SaaS para Clínicas e Consultórios

Plataforma multi-tenant completa: pacientes, agenda, prontuário, financeiro, TISS, estoque, relacionamento, BI e administração SaaS.

**Fases entregues:** 1–13 (Interoperabilidade FHIR/RNDS/laboratórios + IA aplicada).

## Módulos

| Módulo | Rotas principais |
|--------|------------------|
| Pacientes | `/app/pacientes` |
| Agenda / Recepção | `/app/agenda`, `/app/recepcao` |
| Prontuário | `/app/prontuario`, `/app/atendimento/[id]` |
| Financeiro | `/app/financeiro` |
| Faturamento TISS | `/app/faturamento` |
| Estoque | `/app/estoque` |
| Relacionamento | `/app/relacionamento` |
| BI / Dashboard | `/app/dashboard`, `/app/relatorios` |
| Admin / Billing | `/app/assinatura`, `/app/configuracoes/permissoes`, `/app/sistema` |

Documentação por módulo: [`docs/`](docs/)

## Stack

- Next.js 14 (App Router), TypeScript strict, Prisma 7 + PostgreSQL
- Auth.js v5 (JWT), Zod, Tailwind + shadcn/ui
- Vitest + Playwright E2E

## Stack

- Next.js 14 (App Router)
- TypeScript strict
- Prisma 7 + `@prisma/adapter-pg` + PostgreSQL
- Auth.js v5 (JWT)
- Zod
- Tailwind CSS + shadcn/ui
- Vitest

## Pré-requisitos (Windows / PowerShell)

- Node.js 20+
- PostgreSQL 15+ (local ou Railway)
- Git

## Setup

### 1. Clonar e instalar dependências

```powershell
cd C:\Users\diego\Documents\vital8
npm install
npm approve-scripts --allow-scripts-pending
```

### 2. Configurar variáveis de ambiente

```powershell
Copy-Item .env.example .env
```

Edite `.env` com sua `DATABASE_URL` PostgreSQL.

Gere chaves seguras (32 bytes em base64):

```powershell
# AUTH_SECRET
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# PHI_ENCRYPTION_KEY
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# CPF_HASH_KEY (mesmo formato — chave dedicada para HMAC do cpfHash)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 3. Banco de dados

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 4. Executar

```powershell
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## Contas de desenvolvimento (após seed)

Senha para todas: `Vital8@dev`

| E-mail | Papel | Organização |
|--------|-------|-------------|
| ana@vidaplena.local | OWNER | Clínica Vida Plena |
| carlos@drteste.local | OWNER | Consultório Dr. Teste |
| bruno@multi.local | ADMIN + FINANCEIRO | Ambas (testar switcher) |
| carla@vidaplena.local | RECEPCAO | Clínica Vida Plena |
| edu@vidaplena.local | ESTOQUE | Clínica Vida Plena |

Pacientes seed: 15 fictícios (10 Clínica Vida Plena + 5 Consultório Dr. Teste).

Agenda seed: profissionais, serviços, salas, grades semanais, feriados e ~30 agendamentos por organização (passados/futuros em vários status).

## Testes

```powershell
# Criptografia PHI
npm test -- src/lib/crypto/phi.test.ts

# Hash/busca (CPF, nome)
npm test -- src/lib/crypto/search-hash.test.ts

# Isolamento multi-tenant (core)
npm test -- src/lib/db/tenant-isolation.test.ts

# Isolamento multi-tenant (pacientes)
npm test -- src/modules/patients/patient-tenant-isolation.test.ts

# Isolamento multi-tenant (agenda)
npm test -- src/modules/scheduling/appointment-tenant-isolation.test.ts

# Conflitos, slots e recorrência
npm test -- src/modules/scheduling/conflict.test.ts
npm test -- src/modules/scheduling/slot.test.ts
npm test -- src/modules/scheduling/recurrence.test.ts

# EMR — imutabilidade, PHI, permissões
npm test -- src/modules/emr/integrity.test.ts
npm test -- src/modules/emr/encounter-immutability.test.ts
npm test -- src/modules/emr/encounter-phi.test.ts
npm test -- src/modules/emr/emr-permissions.test.ts

# Todos os testes
npm test

# Typecheck
npx tsc --noEmit
```

## Estrutura principal

```
src/
  app/                      # Rotas Next.js
  modules/core/             # Organização, membros, convites, auditoria
  modules/patients/         # CRM clínico (Fase 2)
  modules/scheduling/       # Agenda, recepção (Fase 3)
  modules/emr/              # Prontuário eletrônico (Fase 4)
  modules/finance/            # Financeiro (Fase 5)
  lib/integrations/digital-signature/  # Assinatura dev / ICP futuro
  lib/integrations/prescription-provider/  # Catálogo local / Memed futuro
  lib/db/                   # admin-client, tenant-client
  lib/auth/                 # Auth.js, guards
  lib/crypto/               # PHI encryption + search hash
  lib/features/             # Feature flags por plano
  lib/integrations/storage/ # Upload local (dev) / S3 futuro
  lib/integrations/messaging/ # WhatsApp/SMS/e-mail (console em dev)
prisma/
  schema.prisma
  seed.ts
```

## Multi-tenancy

- Isolamento row-level por `organizationId`
- `createTenantClient(orgId)` injeta filtros automaticamente
- `adminPrisma` apenas para rotinas de sistema (documentado em `admin-client.ts`)

## Deploy

- **App:** Vercel
- **PostgreSQL:** Railway

Configure as mesmas variáveis de ambiente nos dois serviços.

## Decisões arquiteturais

Ver [DECISOES.md](./DECISOES.md)

---

## CHECKLIST DE VERIFICAÇÃO — Fase 4 (Prontuário)

```powershell
npx prisma migrate status
npx tsc --noEmit
npm test
npm run build
npm run dev
```

Fluxo manual (`ana@vidaplena.local` / `Vital8@dev`):

1. `/app/recepcao` → **Iniciar atendimento** em paciente agendado → abre `/app/atendimento/[id]`
2. Preencher SOAP / anamnese → alertas de alergias no topo
3. Prescrever medicamento (autocomplete) → **PDF receita**
4. Emitir atestado ou solicitar exame
5. **Assinar e finalizar** → appointment FINALIZADO
6. Tentar editar seção → deve bloquear; usar **adendo**
7. Ficha paciente → timeline com encontros/prescrições; aba **Acessos** (OWNER)
8. Odontologia: odontograma SVG clicável
9. Psicologia: registro reservado oculto para não-autor
10. `carla@vidaplena.local` (RECEPCAO) → só metadados, sem conteúdo clínico
11. Fisioterapia: mapa corporal (clique no diagrama)
12. Resultado de exame: upload PDF/imagem + valores estruturados → **Ver anexo** inline
13. Histórico → **Repetir receita** no atendimento aberto
14. Nutrição: formulário versionado (Configurações → Prontuário)

---

## CHECKLIST DE VERIFICAÇÃO — Fase 5 (Financeiro)

```powershell
npx prisma migrate status
npx tsc --noEmit
npm test
npm run build
npm run db:seed
npm run dev
```

Fluxo manual (`ana@vidaplena.local` / `Vital8@dev`):

1. `/app/financeiro/caixa` → **Abrir caixa** com fundo de troco (ex.: 10000 centavos = R$ 100)
2. `/app/recepcao` → finalizar atendimento → seção **Finalizados — checkout** → **Receber**
3. Checkout com desconto (motivo obrigatório) e parcelamento (ex.: 3x)
4. Sangria e reforço no caixa; **fechamento cego** informando valor contado → conferir diferença
5. `/app/financeiro/receber` → baixa manual de parcela; **Régua de cobrança** (console messaging)
6. `/app/financeiro/repasse` → apurar período por profissional → fechar extrato
7. `/app/financeiro/dre` → DRE do mês → exportar CSV
8. `/app/financeiro/fluxo` → realizado + projetado
9. Ficha paciente → linha do tempo com vendas e pagamentos
10. `bruno@multi.local` (FINANCEIRO) → módulo financeiro sem conteúdo clínico

---

## CHECKLIST DE VERIFICAÇÃO — Fase 6 (TISS/TUSS)

```powershell
npx prisma migrate status
npx tsc --noEmit
npm test
npm run build
npm run db:seed
npm run dev
```

Fluxo manual (`ana@vidaplena.local` / `Vital8@dev` — org **ENTERPRISE**):

1. `/app/configuracoes/convenios` — operadoras (ANS, versão TISS **3.05 ou 4.03**), banner regulatório jul/2026, vínculo tabela de preços, mapeamento Service ↔ TUSS, import CSV
2. Agendar por convênio (não particular) com carteirinha; operadora Unimed exige autorização
3. `/app/faturamento/autorizacoes` — registrar senha/validade ou verificar alertas de expiração
4. `/app/recepcao` — check-in: alertas de elegibilidade (carteirinha, TUSS, autorização)
5. Finalizar atendimento → guia TISS gerada automaticamente em `/app/faturamento`
6. Corrigir pendência (guia RASCUNHO) → **Revalidar** até status PRONTA
7. Selecionar guias → **Gerar lote** → **Fechar lote** → **Baixar XML**
8. Validar XML: epílogo `<hash>` MD5, namespace ANS, estrutura por versão (testes `validator.test.ts`; ver `docs/tiss.md`)
9. **Enviar** lote (adapter mock) → `/app/faturamento/conciliacao` — lançar demonstrativo guia a guia
10. Aplicar glosa parcial → `/app/faturamento/glosas` — iniciar recurso
11. Conferir indicadores na dashboard de faturamento (% glosa, prazo pagamento, pendentes)
12. Checkout convênio na recepção: sem cobrança (ou coparticipação se configurada)
13. Imprimir guia: `/app/faturamento/guias/[id]/imprimir`

---

## CHECKLIST DE VERIFICAÇÃO — Fase 7 (Estoque)

```powershell
npx prisma migrate status
npx tsc --noEmit
npm test
npm run build
npm run db:seed
npm run dev
```

Fluxo manual (`ana@vidaplena.local` ou `edu@vidaplena.local` / `Vital8@dev`):

1. `/app/estoque/produtos` — criar produto com lote/validade e controlado (344)
2. `/app/estoque/compras` — pedido de compra → enviar → receber **parcial** com lote/custo
3. `/app/configuracoes/servicos` — configurar kit por serviço
4. Finalizar atendimento → checkout mostra materiais consumidos → conferir baixa FEFO no kardex
5. `/app/estoque/movimentacoes` — transferência entre localizações (barcode input)
6. `/app/estoque/inventario` — abrir → contagem às cegas → fechar com divergência → ajustes auditados
7. `/app/estoque/produtos/[id]` — kardex com saldo corrente
8. `/app/estoque/relatorios` — curva ABC, perdas, livro de controlados
9. Verificar alertas de mínimo e validade na dashboard `/app/estoque`
10. Conta `edu@vidaplena.local` (ESTOQUE) — acesso operacional sem financeiro clínico

---

## CHECKLIST DE VERIFICAÇÃO — Fase 8 (Relacionamento)

```powershell
npx prisma migrate status
npx tsc --noEmit
npm test
npm run build
npm run db:seed
npm run dev
```

Fluxo manual (`ana@vidaplena.local` / `Vital8@dev`):

1. `/agendar/clinica-vida-plena` — agendar online com OTP (código no console)
2. `/app/relacionamento/aprovacoes` — aprovar agendamento online
3. `/app/relacionamento` — processar fila de confirmações (dev)
4. Confirmar via `/confirmar/[token]`
5. Teleconsulta: termo em `/teleconsulta/seed-teleconsult-consent-token` → sala no atendimento
6. `/portal/clinica-vida-plena` — documentos e consultas
7. `/nps/seed-nps-token-1` — responder pesquisa
8. Relatório NPS em `/app/relacionamento/nps`
9. Cron manual: `curl -H "Authorization: Bearer %CRON_SECRET%" http://localhost:3000/api/jobs/process`

---

## CHECKLIST DE VERIFICAÇÃO — Fase 10 (Administração e Billing)

```powershell
npx prisma migrate status
npx prisma generate
npx tsc --noEmit
npm test
npm run build
npm run test:e2e
npm run dev
```

Fluxo manual (`ana@vidaplena.local` / `Vital8@dev`):

1. Header — trocar unidade (Todas / Unidade Principal / Unidade Norte) e ver filtros operacionais
2. `/app/configuracoes/permissoes` — criar perfil custom; testar RECEPCAO sem prontuário
3. `/app/assinatura` — ver uso × limites; upgrade via checkout mock (`/checkout/mock`)
4. `/precos` — página pública de planos
5. `/app/onboarding` — checklist retomável pós-cadastro
6. OWNER — exportação completa (action lifecycle)
7. `/app/sistema` — saúde jobs/fila; `/api/health` para monitoramento
8. `npm run db:seed:demo` — demo comercial 2 unidades
9. E2E: cross-tenant e cross-unidade devem falhar (ver `e2e/`)

Deploy: Vercel (app) + Railway (PostgreSQL) · Crons: `/api/jobs/process` com `CRON_SECRET`

---

## CHECKLIST DE VERIFICAÇÃO — Fase 9 (BI, Indicadores e Gestão)

```powershell
npx prisma migrate status
npx prisma generate
npx tsc --noEmit
npm test
npm run build
npm run dev
```

Fluxo manual (`ana@vidaplena.local` / `Vital8@dev` — plano ENTERPRISE com BI completo):

1. `/app/dashboard` — KPIs com variação vs mês anterior, gráficos Recharts, funil, ranking
2. Login `carla@vidaplena.local` (RECEPCAO) — dashboard do dia: fila, confirmações, aniversariantes, online pendente
3. Login profissional vinculado — dashboard restrito (produção, ocupação, repasse; sem financeiro global)
4. `/app/relatorios` — catálogo unificado; export CSV em gráficos (botão CSV)
5. `/app/relatorios/epidemiologia` — CIDs agregados (OWNER/ADMIN/PROFISSIONAL)
6. Dashboard executivo — botão **PDF** (cabeçalho da clínica)
7. `/app/metas` — meta mensal, barra de progresso e projeção linear
8. Sino no header — notificações; preferências in-app/e-mail no painel
9. Resumo semanal: `curl -H "Authorization: Bearer %CRON_SECRET%" http://localhost:3000/api/jobs/process` (segunda 7h SP ou force via seed)
10. OWNER — reprocessar agregados: action `reprocessMetricsAction` (últimos 7 dias no job automático)
11. Plano STARTER (`carlos@drteste.local`) — dashboard simples do dia (sem BI completo)

---

## CHECKLIST DE VERIFICAÇÃO — Fase 8 (Relacionamento)

```powershell
npx prisma migrate status
npx tsc --noEmit
npm test
npm run build
npm run dev
```

Fluxo manual (`ana@vidaplena.local` / `Vital8@dev`):

1. `/app/configuracoes/agenda` — profissionais, serviços, salas, grade, feriados, limite de espera
2. `/app/agenda` — duplo clique em slot → agendar (busca ou cadastro rápido)
3. Confirmar por link — URL no console `[Vital8 Messaging]` → `/confirmar/[token]`
4. `/app/recepcao` — check-in, fila, confirmar, falta, cancelar
5. `/painel/clinica-vida-plena` — painel TV; botão Chamar na recepção
6. Remarcar — drag-and-drop na visão dia da agenda
7. `/app/relatorios/agenda` — ocupação, no-show, origem
8. Ficha paciente — consultas na linha do tempo
9. Troca de org — agendas isoladas

---

## CHECKLIST DE VERIFICAÇÃO — Fase 2 (Pacientes)

Execute em PowerShell na raiz do projeto:

```powershell
# 1. Migrations aplicadas
npx prisma migrate status

# 2. TypeScript sem erros
npx tsc --noEmit

# 3. Testes
npm test

# 4. Build de produção
npm run build

# 5. Fluxo manual (dev server: npm run dev)
# Login: ana@vidaplena.local / Vital8@dev
# - /app/pacientes → listar, buscar por nome/CPF/telefone
# - Cadastro rápido → nome + telefone → redireciona para editar
# - Novo paciente → cadastro completo
# - Abrir paciente → ficha, alertas de saúde, linha do tempo
# - Editar → abas contato, convênio, saúde, documentos, LGPD
# - /app/pacientes/aniversariantes → Fernanda (12/07) se data coincidir
# - /app/pacientes/duplicados → mesclagem (criar duplicata de teste)
# - /app/pacientes/importar → CSV com colunas nome,cpf,telefone
# - Exportar LGPD (OWNER) → download JSON
# - Configurações → Auditoria → eventos patient.*
# - Trocar org (bruno@multi.local) → pacientes isolados por tenant
```

## Pendências (fases futuras)

- Messaging WhatsApp/SMS real (adapter pronto)
- Envio de convite por e-mail transacional
- Google OAuth
- Storage S3 em produção

## CHECKLIST DE VERIFICAÇÃO — Fase 11 (API pública)

```powershell
npx prisma migrate status
npx tsc --noEmit
npm test
npm run build
npm run db:seed   # exibe token Doctor8 SANDBOX
npm run dev
```

Fluxo manual:

1. Login `ana@vidaplena.local` / `Vital8@dev` (ENTERPRISE)
2. **Configurações → API e Integrações** — client Doctor8 já seedado; criar nova key e copiar secret
3. `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/ping`
4. Criar paciente com `Idempotency-Key` (ver `docs/api.md`)
5. Consultar `/api/v1/availability` e criar agendamento
6. Webhook eco em `/api/webhooks/echo` — disparar evento e validar `X-Vital8-Signature`
7. Estourar rate limit (61 req/min em org BASICO ou usar testes)
8. Revogar key e confirmar 401
9. Abrir `/app/desenvolvedores` — spec Scalar carrega `/api/v1/openapi.json`

Documentação: [`docs/api.md`](docs/api.md)

## CHECKLIST DE VERIFICAÇÃO — Fase 12 (IA aplicada)

```powershell
npx prisma migrate status
npx tsc --noEmit
npm test
npm run build
npm run db:seed
npm run dev
```

Fluxo manual (ENTERPRISE — `ana@vidaplena.local` / `Vital8@dev`):

1. **Configurações → IA** — habilitar recursos e registrar consentimento LGPD (OWNER)
2. Simulador: conversa "Quero agendar consulta" → horários reais do sistema
3. Atendimento: **Resumir histórico** → aceitar/rejeitar (AiInteractionLog)
4. Ditado → **Estruturar SOAP** → revisar antes de salvar
5. **Sugerir CID-10** a partir de hipótese
6. **Recepção** — painel de risco de no-show no topo
7. **Dashboard** — card "Insights do mês" + "Explicar gráfico"
8. **Faturamento → Glosas** — botão "Rascunho IA" na justificativa
9. **Ctrl+K** — busca natural ("agenda amanhã", "vencidos")
10. Reduzir `monthlyTokenLimit` em AiSettings e confirmar bloqueio ao estourar

## CHECKLIST DE VERIFICAÇÃO — Fase 13 (Interoperabilidade FHIR / RNDS / Laboratórios)

```powershell
npx prisma migrate status
npx tsc --noEmit
npm test
npm run build
npm run db:seed
npm run dev
```

Fluxo manual (ENTERPRISE — `ana@vidaplena.local` / `Vital8@dev`):

1. **Configurações → Interoperabilidade** — salvar credencial RNDS mock (homologação) e testar conexão
2. Verificar monitor: submissão **aceita**, **rejeitada** (OperationOutcome traduzido) e **em fila** do seed
3. Reenviar submissão rejeitada/DLQ pelo botão **Reenviar**
4. Confirmar atendimento **assinado** no seed gera Bundle RAC válido (job ou enfileiramento manual)
5. **Laboratórios** — informar ID de um `ExamRequest` do seed → simular fluxo ponta a ponta
6. Verificar notificação ao profissional solicitante e liberação no portal do paciente
7. Consumir FHIR nativo: `GET /api/v1/fhir/Patient` com API key da Fase 11 (escopo `patients:read` + org ENTERPRISE)
8. Receber resultado via API: `POST /api/v1/inbound/lab-results` com escopo `lab:inbound`

Guia credenciamento real: [`docs/rnds.md`](docs/rnds.md)

## CHECKLIST DE VERIFICAÇÃO — Fase 14 (PWA Mobile + Agenda Offline)

```powershell
npx prisma migrate status
npx tsc --noEmit
npm test
npm run build
npm run test:e2e
npm run dev
```

Fluxo manual (PRO/ENTERPRISE — `ana@vidaplena.local` / `Vital8@dev`):

1. **Instalar PWA** — 2º acesso exibe banner discreto; em Android: menu → "Adicionar à tela inicial"; em iOS: Compartilhar → "Adicionar à Tela de Início"
2. Abrir `/m/hoje` — bottom nav (Hoje · Agenda · Pacientes · Notificações · Perfil)
3. Verificar banner de **última sincronização** online
4. **Push** — Centro de notificações (sino) → habilitar Push e categorias (check-in, exame, etc.)
5. **Modo avião** no celular (ou DevTools offline):
   - Agenda do dia visível do cache
   - Confirmar consulta / marcar falta → enfileirado
   - Criar agendamento provisório em `/m/agenda`
   - `/m/atendimento/*` e prontuário **inacessíveis** offline
6. Reconectar — fila sincroniza; verificar no desktop `/app/agenda`
7. **Conflito** — ocupar mesmo slot no servidor enquanto offline → pendência em Perfil/Agenda (não sobrescreve)
8. **Dark mode** — respeita `prefers-color-scheme`
9. **Logout** — purge do IndexedDB (cache offline zerado)
10. **Admin** — `/app/sistema` lista telemetria de sincronizações mobile

**Lighthouse PWA (produção):** `npm run build && npm start` → Chrome DevTools → Lighthouse → PWA ≥ 90

## CHECKLIST DE VERIFICAÇÃO — Fase 15 (Marketing e Captação)

```powershell
npx prisma migrate status
npx tsc --noEmit
npm test
npm run build
npm run db:seed
npm run dev
```

Fluxo manual (PRO/ENTERPRISE — `ana@vidaplena.local` / `Vital8@dev`):

1. **Landing** — `/app/marketing/landing-pages` → abrir `/lp/clinica-vida-plena/consulta-inicial`
2. **Captura com UTM** — `?utm_source=google&utm_medium=cpc&utm_campaign=verao2026`
3. **Cadência** — job `/api/jobs/process` ou aguardar 5 min → `LeadFollowUpLog`
4. **Kanban** — `/app/marketing/leads` arrastar card entre colunas
5. **Converter** — botão converter lead → paciente (dedup telefone/CPF)
6. **Funil** — agendamento → comparecimento → status CONVERTIDO
7. **Dashboard** — `/app/marketing/dashboard` CAC/LTV/ROI
8. **Indicação** — `/app/marketing/indicacoes` · 2 indicações no seed
9. **NPS promotor** — nota ≥9 dispara convite Google (detrator nunca)
10. **Link rastreável** — `/r/verao26` incrementa cliques
11. **Mini-site** — `/c/clinica-vida-plena` · `sitemap.xml` em `/c/clinica-vida-plena/sitemap.xml`
12. **Embed externo** — `<script src="/embed/lead-form.js" data-org="clinica-vida-plena" async></script>`
13. **Reativação** — dashboard lista inativos 6+ meses e retorno de campanha
