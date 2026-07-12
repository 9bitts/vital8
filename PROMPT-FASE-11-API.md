# PROMPT FASE 11 — API PÚBLICA DE INTEGRAÇÃO (Doctor8 e futuros parceiros)

---

Fases 1–10 validadas. Execute agora a **FASE 11 — API PÚBLICA DO VITAL8**: uma API REST versionada, segura e documentada, que expõe os módulos do sistema para integrações externas. O primeiro consumidor será o **Doctor8** (aplicação parceira da mesma empresa), mas a API deve ser genérica: qualquer parceiro autorizado se integra pelos mesmos contratos, sem nada hard-coded para o Doctor8. Todas as regras invioláveis do prompt mestre continuam valendo (tenant isolation, PHI, auditoria, LGPD).

## Escopo obrigatório

### 11.1 Arquitetura

1. Rotas em `/api/v1/*` (Next.js Route Handlers), versionamento na URL; nunca quebrar contrato dentro da v1 (mudanças breaking → v2).
2. Camada própria `src/modules/api/` com: autenticação de cliente, autorização por escopo, serializers (DTOs — NUNCA expor o shape do Prisma nem campos internos), validação Zod de entrada E saída, tratamento de erro padronizado.
3. **Reutilizar os services existentes dos módulos** — a API não reimplementa regra de negócio; chama os mesmos services das Server Actions (refatorar services para serem agnósticos de transporte onde necessário, sem alterar comportamento — testes existentes continuam verdes).
4. Respostas JSON padronizadas: sucesso `{ data, meta }`; erro `{ error: { code, message, details[] } }` com códigos estáveis (`VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INSUFFICIENT_SCOPE`...). Paginação por cursor (`?cursor=&limit=`, máx. 100), filtros e ordenação documentados por recurso, datas ISO 8601 UTC.

### 11.2 Autenticação, autorização e segurança

**Models:** `ApiClient` (nome — ex.: "Doctor8" —, organização, ambiente SANDBOX/PRODUCTION, ativo), `ApiKey` (par `vk_live_...`/`vk_test_...` + secret com hash — mostrado uma única vez na criação —, escopos, expiração opcional, último uso, revogável), `ApiRequestLog` (método, rota, client, status, latência, IP — sem payload com PHI), `WebhookEndpoint` + `WebhookDelivery` (ver 11.4).

**Regras:**

1. Autenticação por API key no header `Authorization: Bearer` + assinatura HMAC opcional do corpo (`X-Vital8-Signature`) para operações de escrita — documentar.
2. **Escopos por módulo e ação:** `patients:read`, `patients:write`, `appointments:read`, `appointments:write`, `schedule:read`, `encounters:read`, `documents:read`, `financial:read`, `financial:write`, `insurance:read`, `stock:read`, `webhooks:manage`. Key só acessa o que tem escopo; conteúdo clínico (`encounters:read`) exige habilitação extra pelo OWNER com justificativa registrada (LGPD).
3. Toda key pertence a UMA organização — o tenant client é criado a partir dela; impossível cruzar tenants (teste obrigatório).
4. Rate limiting por key (janela deslizante, limites por plano: ex. 60 req/min BASICO, 300 PRO, 1000 ENTERPRISE) com headers `X-RateLimit-*` e `Retry-After`.
5. **Idempotência:** header `Idempotency-Key` obrigatório em todo POST que cria recurso (armazenar resposta por 24h; repetição retorna a mesma resposta, não duplica).
6. Auditoria: toda escrita via API gera AuditLog com autoria `api:<clientName>`; acesso a dado clínico gera RecordAccessLog.
7. Ambiente SANDBOX: keys de teste operam apenas na organização demo do seed — nunca em dados reais.

### 11.3 Recursos expostos (v1)

Para cada recurso: GET lista (filtros + cursor), GET por id, e escrita onde indicado. Campos sempre via DTO documentado.

1. **Pacientes** `/api/v1/patients` — CRUD (sem delete físico; DELETE = inativar). Busca por `cpf` (via cpfHash), telefone, nome, `updatedAfter` (sincronização incremental). Sub-recursos: convênios do paciente, alergias/condições (read), consentimentos (read + registrar).
2. **Profissionais e serviços** `/api/v1/professionals`, `/api/v1/services` — read.
3. **Agenda** `/api/v1/availability?professionalId=&serviceId=&from=&to=` (slots livres reais, mesmas regras do agendamento online) e `/api/v1/appointments` — criar, remarcar (`POST /:id/reschedule`), cancelar com motivo, confirmar; transições respeitam a máquina de estados (`409 CONFLICT` se inválida); campo `origin` = `API_<CLIENT>`.
4. **Atendimentos (read-only)** `/api/v1/encounters` — metadados sempre; conteúdo clínico somente com escopo especial (seções descriptografadas no DTO, acesso logado). Prescrições e atestados: metadados + download do PDF por URL assinada expirante.
5. **Documentos** `/api/v1/patients/:id/documents` — listar, baixar (URL assinada), enviar (upload via URL pré-assinada).
6. **Financeiro** `/api/v1/receivables`, `/api/v1/payments` (read; registrar pagamento externo com `financial:write`), `/api/v1/sales` (read).
7. **Convênios** `/api/v1/insurers`, elegibilidade `/api/v1/patients/:id/insurance-eligibility` (read).
8. **Estoque** `/api/v1/products` + saldos (read).
9. **Utilitários:** `/api/v1/ping` (valida key e retorna escopos), `/api/v1/organization` (dados básicos + unidades).

### 11.4 Webhooks (eventos de saída)

1. `WebhookEndpoint` por client: URL, segredo para assinatura HMAC-SHA256 (`X-Vital8-Signature: t=<ts>,v1=<hmac>`), eventos assinados, ativo.
2. Eventos mínimos: `patient.created|updated`, `appointment.created|updated|status_changed|cancelled`, `encounter.signed`, `document.released`, `payment.received`, `receivable.overdue`, `tiss.glosa_received`. Payload = DTO do recurso + `event`, `id`, `occurredAt` — **sem PHI sensível no corpo** (enviar id; o consumidor busca detalhe pela API conforme escopo).
3. Entrega via processador de jobs da Fase 8: retry com backoff exponencial (5 tentativas), DLQ visível na UI, reenvio manual, desativação automática após N falhas consecutivas com notificação.
4. Endpoint de teste: disparar evento de exemplo para validar integração.

### 11.5 Documentação e DX

1. **OpenAPI 3.1** gerada a partir dos schemas Zod (usar `zod-to-openapi` ou equivalente — documentar escolha): spec em `/api/v1/openapi.json` + portal de documentação `/app/desenvolvedores` com Scalar ou Swagger UI embarcado.
2. Guia de integração em `docs/api.md`: autenticação, escopos, idempotência, rate limits, webhooks (verificação de assinatura com exemplo de código), sincronização incremental via `updatedAfter`, erros. Incluir exemplos `curl` de cada fluxo e uma coleção de exemplos ponta a ponta do caso Doctor8: sincronizar pacientes → consultar disponibilidade → criar agendamento → receber webhook de confirmação → baixar receita após `encounter.signed`.
3. UI de gestão em `/app/configuracoes` → aba "API e Integrações" (OWNER/ADMIN): criar client e keys (secret exibido uma vez), escopos com explicação, revogar, logs de requisição com filtros, webhooks + entregas/DLQ, uso × rate limit. Tudo auditado.

**Feature flag:** API em PRO/ENTERPRISE; webhooks em ENTERPRISE (ou PRO, documentar decisão).

**Seed:** ApiClient "Doctor8" (sandbox) com key de teste, escopos de pacientes+agenda, 1 webhook apontando para endpoint de eco local, e exemplos de ApiRequestLog/WebhookDelivery.

## Testes obrigatórios

Isolamento cross-tenant via API (key da org A jamais lê org B — teste direto e por manipulação de ids); escopo insuficiente → 403 `INSUFFICIENT_SCOPE`; idempotência (mesmo `Idempotency-Key` não duplica appointment); rate limit; máquina de estados via API (transição inválida → 409); assinatura de webhook verificável; retry/DLQ; contrato — validar respostas contra a spec OpenAPI nos testes de integração; PHI nunca presente em payload de webhook nem em `ApiRequestLog`.

## Entrega

`npx tsc --noEmit` limpo, `npm run build` verde, `npm test` passando (incluindo os testes acima), migrations aplicáveis, README.md com checklist manual da Fase 11 (criar client Doctor8, testar `ping`, criar paciente via curl com idempotência, consultar disponibilidade e agendar, receber webhook assinado no endpoint de eco, estourar rate limit, revogar key, spec abrindo no portal) e DECISOES.md atualizado (versionamento, biblioteca OpenAPI, política de escopos clínicos). Se dividir (11A auth+infra+clients, 11B recursos v1, 11C webhooks+docs+UI), apresente o plano e execute na sequência.

Comece.
