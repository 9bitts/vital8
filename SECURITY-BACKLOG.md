# Security Backlog — Vital8

Itens **não corrigidos** na auditoria de 2026-07-12, ordenados por impacto.

## 🔴 Alta prioridade

| ID | Severidade | Item | Sugestão |
|----|------------|------|----------|
| A-04 | 🔴 | **Multi-unidade incompleta** — `branchFilter` só em `listAppointmentsAction` | Aplicar em `searchPatients`, leads, caixa, estoque, relatórios; validar `branchId` em mutações |
| B-04 | 🔴 | **JWT sem revogação** ao desativar membro ou trocar senha | `maxAge` curto (8h) + tabela `sessionVersion` no token ou sessão database |
| B-06 | ⚠️→🔴 | **HMAC opcional** na API — `verifyHmacSignature` retorna `true` se header ausente | Exigir `X-Vital8-Signature` em POST/PUT/PATCH/DELETE em produção |

## ⚠️ Média prioridade

| ID | Severidade | Item | Sugestão |
|----|------------|------|----------|
| B-05 | ⚠️ | Enumeração de e-mail no **signup** | Mensagem genérica + e-mail de "tentativa de cadastro" |
| E-04 | ⚠️ | Webhook billing mock sem assinatura persistente | Validar assinatura Stripe real; idempotência em DB |
| F-02 | ⚠️ | CSP `unsafe-inline` / `unsafe-eval` | Nonce-based CSP; remover eval |
| F-03 | ⚠️ | `npm audit` high (glob) / moderate (hono) | Atualizar eslint-config-next / prisma quando ciclo permitir |
| D-03 | ⚠️ | Landing pages — blocos HTML futuros | DOMPurify ou markdown-only |
| C-06 | ⚠️ | `scheduled-report.service.ts:82` loga corpo de e-mail | Redact em produção |
| C-07 | ⚠️ | `MockAds` / `MockPush` logam em dev | Garantir adapters reais em staging/prod |
| G-04 | ⚠️ | Escalonamento de papel via convite/membership | Teste + bloqueio: convidador não pode conceder papel > próprio |
| H-05 | ⚠️ | Exportação LGPD — menções a terceiros em notas | Revisar `buildLgpdExport` redaction |
| A-09 | ⚠️ | `processCommunicationQueue` global sem partition key | Aceitável (cada log tem orgId); considerar fila por tenant em escala |

## ✅ Baixa prioridade / aceitos conscientemente

| ID | Item | Trade-off (DECISOES.md) |
|----|------|-------------------------|
| T-01 | `adminPrisma` em serviços de job/automação | Parâmetro `organizationId` explícito — documentado |
| T-02 | Tokens públicos NPS/confirmação por URL | UUID 24 bytes + expiração 7d |
| T-03 | Contas demo `*@*.local` | Apenas seed dev; bloqueado em prod |
| T-04 | Painel TV `/api/painel` público por slug | Dados minimizados; rate limit recomendado |

## Testes de regressão pendentes

- [ ] E2E Playwright: login lockout após 10 tentativas
- [ ] E2E: usuário unidade A não vê appointment unidade B
- [ ] Integração: webhook rejeita `http://127.0.0.1`
- [ ] Integração: JWT invalidado após `membership.isActive=false`
