# PROMPT — AUDITORIA COMPLETA DE SEGURANÇA E CORREÇÕES (copiar e colar no Cursor a qualquer momento; ideal após cada grande fase e obrigatório antes de produção)

---

Assuma o papel de **auditor de segurança sênior especializado em aplicações de saúde (LGPD, dados sensíveis/PHI)**. Sua missão tem DUAS partes obrigatórias: (1) auditar TODO o código do Vital8 contra o checklist abaixo, produzindo um relatório; (2) **corrigir** o que for encontrado, por ordem de severidade. Não é uma revisão superficial: abra os arquivos, siga os fluxos de dados e prove cada achado com trecho de código e caminho do arquivo.

## PARTE 1 — AUDITORIA

Percorra o checklist inteiro. Para cada item, classifique: ✅ CONFORME / ⚠️ MELHORIA / 🔴 CRÍTICO, com evidência (arquivo:linha) e explicação. Gere o relatório em `SECURITY-AUDIT.md` (data, versão do commit, sumário executivo com contagem por severidade, achados detalhados, plano de correção).

### A. Isolamento multi-tenant (a falha mais grave possível neste sistema)

1. Busque TODOS os usos de `adminPrisma`/`admin-client` fora de `src/lib/db/` — cada um deve ter guard de papel + filtro explícito `organizationId` + comentário justificando. Liste os que não têm.
2. Toda Server Action, Route Handler (`/api/*`, incluindo API pública v1, rotas públicas, webhooks de entrada, jobs/cron) e página server-side: confirme que obtém `organizationId` da SESSÃO/API KEY (nunca de input do cliente — body, query, header, cookie manipulável).
3. IDs de recursos vindos do cliente (`patientId`, `appointmentId`, etc.): confirme que TODA busca por id passa pelo tenant client ou revalida a org (IDOR). Teste mental: usuário da org A envia id da org B — o que acontece? Faça isso para os 10 endpoints mais sensíveis e documente.
4. Multi-unidade (Fase 10): usuário restrito à unidade X não pode operar dados da unidade Y.
5. Jobs/cron e processadores de fila: confirmar que iteram por organização sem vazar contexto entre iterações.

### B. Autenticação e sessões

1. Auth.js: expiração e rotação de JWT, invalidação ao desativar membro/trocar senha (se pendente de fase, confirmar mitigação documentada), proteção CSRF nas mutações, cookies `HttpOnly`/`Secure`/`SameSite`.
2. Força de senha, hash (bcrypt com custo adequado), proteção contra enumeração de usuários (mesma resposta para e-mail existente/inexistente no login e no reset), rate limit no login e no OTP do portal (tentativas limitadas + lockout progressivo).
3. Sessão do portal do paciente ISOLADA da sessão da equipe (cookie/escopo distintos); tokens públicos (convite, confirmação de consulta, NPS, links assinados de arquivos) — aleatoriedade criptográfica, expiração, uso único onde aplicável, invalidação.
4. API pública: secrets hasheados no banco (nunca em claro), key mostrada só na criação, revogação imediata, escopos aplicados em TODAS as rotas (procure rota que esqueceu o check), sandbox jamais toca dados reais.

### C. Criptografia e PHI

1. Inventário: liste TODOS os campos com dado pessoal/sensível no `schema.prisma` e confirme quais são criptografados com `phi.ts` — aponte campo sensível em claro sem justificativa documentada em DECISOES.md.
2. `phi.ts`: AES-256-GCM com IV único por operação, autenticação do ciphertext, chave só via env, procedimento de rotação de chave documentado e script funcional.
3. PHI NUNCA em: logs (`console.*`, logger), `AuditLog`/`ApiRequestLog` (metadados ok, conteúdo não), mensagens de erro retornadas ao cliente, URLs/query strings, payloads de webhook de saída, eventos para plataformas de ads (Fase 15), telemetria. Faça grep sistemático e prove.
4. Cache offline do PWA (Fase 14): criptografia do IndexedDB, purge no logout, prontuário fora de cache persistente. Certificado RNDS (Fase 13) armazenado criptografado.
5. Uploads/arquivos: acesso só por URL assinada com expiração; storage não público; validação de tipo/tamanho no upload (bloquear executáveis, verificar content-type real, não só extensão).

### D. Validação de entrada e injeção

1. Toda Server Action e rota: input validado com Zod ANTES de uso (procure handlers que usam `formData`/`body` direto). Mass assignment: objetos do cliente nunca vão direto ao Prisma (`...data` sem pick explícito é achado).
2. SQL injection: busque `$queryRaw`/`$executeRaw` — apenas com template tag parametrizado, nunca concatenação.
3. XSS: busque `dangerouslySetInnerHTML` e renderização de conteúdo do usuário (templates de mensagem, landing pages da Fase 15, editor de documentos da Fase 4) — sanitização adequada; conteúdo de terceiros nas rotas públicas.
4. XML (TISS Fase 6, FHIR Fase 13): parser com XXE desabilitado, validação contra schema antes de processar arquivo recebido.
5. Geração de PDF: injeção via variáveis de template ({{...}}) escapadas.
6. Path traversal em qualquer manuseio de arquivo por nome.

### E. Rotas públicas e superfície externa

1. Inventarie TODAS as rotas sem autenticação (páginas públicas, `/painel/`, `/confirmar/`, `/agendar/`, `/lp/`, `/c/`, `/r/`, formulários embed, `/api/health`, webhooks de entrada, OTP, links de pagamento) — para cada uma: rate limiting real (não só na intenção), nenhum dado além do mínimo (painel de chamada: só primeiro nome + inicial), sem enumeração de recursos por id sequencial (usar UUID/token), anti-spam nos formulários.
2. Webhooks de ENTRADA (lab results, billing): verificação de assinatura obrigatória, replay protection (timestamp + tolerância), idempotência.
3. Webhooks de SAÍDA: HMAC assinado, sem PHI no payload, URL de destino validada (bloquear SSRF: nada de localhost/IP privado/metadata endpoints — valide e teste).
4. SSRF geral: qualquer fetch de URL fornecida pelo usuário (upload por URL, integração) com allowlist/validação.

### F. Headers, configuração e dependências

1. `next.config`/middleware: CSP efetiva (sem `unsafe-inline` desnecessário), HSTS, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors` (painel de TV pode precisar de exceção específica — restrinja por rota), `Referrer-Policy`, `Permissions-Policy`.
2. CORS da API pública: origens, métodos e headers restritos ao necessário.
3. Segredos: grep por chaves/tokens/senhas hard-coded em todo o repo (incluindo testes e seeds); `.env` no `.gitignore`; seeds de produção sem senhas fracas conhecidas (contas demo `Vital8@dev` NUNCA podem existir em produção — garanta por env check no seed).
4. `npm audit` — corrigir críticas/altas; listar as que não têm fix com mitigação.
5. Mensagens de erro: nenhuma stack trace/detalhe interno vai ao cliente em produção; página de erro genérica; logs internos completos.
6. Variáveis `NEXT_PUBLIC_*`: confirme que nenhuma contém segredo.

### G. Autorização fina e auditoria

1. Matriz papel × ação (Fase 10): teste as combinações proibidas mais críticas — RECEPCAO/FINANCEIRO lendo conteúdo clínico, PROFISSIONAL lendo financeiro global, registro reservado de psicologia visível só ao autor, portal do paciente acessando dado de outro paciente.
2. Escalonamento: usuário pode editar a própria Membership/papel? Convite pode conceder papel maior que o do convidador?
3. Trilha de auditoria: eventos críticos sem auditoria (procure mutações sem chamada ao audit service); `RecordAccessLog` em TODA leitura de prontuário (UI, API, portal); logs de auditoria são imutáveis (sem endpoint de edição/delete).
4. Imutabilidade do prontuário assinado: prove que não há caminho de update (nem via API, nem via admin client).

### H. Lógica de negócio sensível

1. Dinheiro: renegociação/estorno/desconto revalidam limites no SERVIDOR (não confiar na UI); race conditions em caixa e numeração de guias/lotes (transações/locks); pagamento externo via API não pode baixar recebível de outra org.
2. Idempotência real nos POSTs da API e na fila offline (replay do mesmo request não duplica).
3. IA (Fase 12): pipeline de minimização aplicado em TODA chamada externa (procure chamada ao adapter llm que passa contexto sem passar pelo pipeline); prompt injection da secretária (paciente escrevendo instruções) — confirme que dados do sistema e instruções estão separados e ações são whitelisted.
4. LGPD: anonimização é irreversível e completa (verifique campo a campo), exportação do titular não vaza dados de OUTROS pacientes (ex.: nota que menciona terceiro), opt-out efetivo em todos os canais.

## PARTE 2 — CORREÇÕES

1. Corrija TODOS os 🔴 CRÍTICOS imediatamente, um commit por achado (mensagem referenciando o item do relatório).
2. Corrija os ⚠️ de maior impacto; os demais, liste em `SECURITY-BACKLOG.md` com severidade e sugestão.
3. **Para cada correção de item A, B, C, D ou G: escreva um teste de regressão** que falharia com o código antigo (ex.: teste IDOR cross-tenant por endpoint, teste de PHI em log, teste de escopo da API).
4. Adicione ao CI (`npm test`) uma suíte `security.test.ts` consolidando os testes de regressão + checks estáticos automatizáveis (grep de PHI em log, adminPrisma sem justificativa, rota pública sem rate limit — via convenção/lint rule customizada quando possível).
5. Nada de quebrar comportamento: `npx tsc --noEmit`, `npm run build`, `npm test` e `npm run test:e2e` verdes ao final.

## Entrega

`SECURITY-AUDIT.md` completo com evidências; correções commitadas por severidade; `SECURITY-BACKLOG.md` com o restante; suíte de regressão de segurança no CI; DECISOES.md atualizado (trade-offs de segurança aceitos conscientemente); resumo final: o que era crítico, o que foi corrigido, o que ficou no backlog e recomendação objetiva — o sistema está ou não pronto para produção com dados reais de pacientes?

Se o volume for grande, execute em blocos (A–C crítico primeiro → relatório parcial → correções → D–H) sem parar entre blocos. Comece pela PARTE 1, seção A.
