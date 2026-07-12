# Security Backlog — Vital8

Itens **não corrigidos** na auditoria de 2026-07-12, ordenados por impacto.

## 🔴 Alta prioridade

| ID | Severidade | Item | Status |
|----|------------|------|--------|
| A-04 | 🔴 | **Multi-unidade incompleta** | ✅ Fase 16A — `branchFilter` em pacientes (via vínculo), leads, caixa, estoque, financeiro, BI |
| B-04 | 🔴 | **JWT sem revogação** | ✅ Fase 16A — `sessionVersion` em User/Membership, `maxAge` 8h |
| B-06 | 🔴 | **HMAC opcional** na API | ✅ Fase 16A — obrigatório em produção |

## ⚠️ Média prioridade

| ID | Severidade | Item | Status |
|----|------------|------|--------|
| B-05 | ⚠️ | Enumeração de e-mail no **signup** | ✅ Fase 16A — mensagem genérica |
| E-04 | ⚠️ | Webhook billing mock | ✅ Fase 16A — assinatura + idempotência DB |
| F-02 | ⚠️ | CSP `unsafe-inline` / `unsafe-eval` | ✅ Fase 16A — nonce em `/app` e `/m`; sem `unsafe-eval` |
| F-03 | ⚠️ | `npm audit` high (glob) / moderate (hono) | Pendente — ciclo de dependências |
| D-03 | ⚠️ | Landing pages — blocos HTML futuros | Pendente |
| C-06 | ⚠️ | `scheduled-report.service.ts` loga corpo de e-mail | ✅ Fase 16A — `safeLog` |
| C-07 | ⚠️ | `MockAds` / `MockPush` logam em dev | ✅ Fase 16A — adapters reais fora de dev |
| G-04 | ⚠️ | Escalonamento de papel via convite | ✅ Fase 16A — `canGrantRole` + testes |
| H-05 | ⚠️ | Exportação LGPD — terceiros em notas | ✅ Fase 16A — `redactThirdPartyText` |
| A-09 | ⚠️ | `processCommunicationQueue` global | Aceito conscientemente |

## ✅ Baixa prioridade / aceitos conscientemente

| ID | Item | Trade-off (DECISOES.md) |
|----|------|-------------------------|
| T-01 | `adminPrisma` em serviços de job/automação | Parâmetro `organizationId` explícito — documentado |
| T-02 | Tokens públicos NPS/confirmação por URL | UUID 24 bytes + expiração 7d |
| T-03 | Contas demo `*@*.local` | Apenas seed dev; bloqueado em prod |
| T-04 | Painel TV `/api/painel` público por slug | Dados minimizados; rate limit recomendado |

## Testes de regressão

- [x] E2E Playwright: login lockout após 10 tentativas (`e2e/branch-isolation.spec.ts`)
- [x] E2E: usuário unidade A não vê appointment unidade B (`e2e/branch-isolation.spec.ts`)
- [x] Integração: webhook rejeita `http://127.0.0.1` (`security.test.ts`)
- [x] Integração: JWT invalidado após `membership.isActive=false` (`session-version.test.ts`)
