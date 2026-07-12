# PROMPT FASE 10 — MULTI-UNIDADE, BILLING DO SAAS E POLIMENTO FINAL (copiar e colar no Cursor após concluir a Fase 9)

---

Fase 9 validada. Execute agora a **FASE 10 — ADMINISTRAÇÃO, BILLING DO SAAS E POLIMENTO**, a fase final, conforme o prompt mestre. Ela fecha o produto para venda: filiais, permissões finas, planos com cobrança, onboarding e a passada final de qualidade ponta a ponta. Reforço do escopo e critérios de aceite:

## Escopo obrigatório

### 10.1 Multi-unidade (filiais)

**Models:** `Branch` (unidade da Organization: nome, endereço, CNES/CNPJ próprios opcionais, ativa) e `branchId` opcional nos models operacionais (Appointment, CashRegister, StockLocation, Room, ScheduleTemplate, TissGuide/lote). Migração segura: criar "Unidade Principal" por organização e backfill de todos os dados existentes.

**Regras:** usuário tem acesso a uma, várias ou todas as unidades (extensão da Membership); seletor de unidade no header (ao lado do seletor de organização) filtrando agenda, recepção, caixa e estoque; relatórios e BI da Fase 9 ganham dimensão unidade (consolidado + por unidade); paciente e prontuário são da ORGANIZAÇÃO (compartilhados entre unidades) — documentar em DECISOES.md. Testes: isolamento por unidade nas telas operacionais e consolidação correta no BI.

### 10.2 Permissões finas

**Models:** `PermissionProfile` (matriz recurso × ação: ver/criar/editar/excluir/aprovar por módulo — pacientes, agenda, prontuário, financeiro, faturamento, estoque, relatórios, configurações) vinculável à Membership, sobrepondo o papel base; limites parametrizáveis já usados nas fases (desconto máximo, valor de estorno, encaixe) centralizados aqui.

**Regras:** papéis atuais viram perfis padrão (seed) — nada quebra; verificação centralizada em `guards.ts` estendido (`can(user, "financeiro.estornar")`); tela de administração de perfis com matriz visual; auditoria de mudança de permissão. Testes das combinações críticas (RECEPCAO sem prontuário clínico, FINANCEIRO sem clínico, perfil custom).

### 10.3 Billing do SaaS

**Models:** `Subscription` (Organization: plano BASICO/PRO/ENTERPRISE, ciclo mensal/anual, status TRIAL/ATIVA/INADIMPLENTE/CANCELADA, trial de 14 dias, limites — usuários, unidades, pacientes ativos — conforme plano), `SubscriptionInvoice`, adapter `billing` (`src/lib/integrations/billing/`: mock em dev com página de checkout fake; interface pronta para Stripe — customer, subscription, webhook de pagamento).

**Regras:** `features.service.ts` passa a ler da Subscription; exceder limite → aviso e bloqueio suave (não perde dado, bloqueia criação); INADIMPLENTE → grace period configurável, depois somente leitura; tela `/app/assinatura` (plano atual, uso × limites, upgrade/downgrade, histórico de faturas); página pública de preços `/precos`. Webhook idempotente e testado.

### 10.4 Onboarding e ciclo de vida da organização

1. Wizard pós-cadastro: dados da clínica (logo, endereço, especialidades) → primeira unidade → profissionais → serviços com duração/preço → grade de agenda → convite da equipe → importação de pacientes (Fase 2) → tour guiado das telas principais. Pulável e retomável (checklist de progresso no dashboard).
2. Exportação completa da organização (OWNER): JSON estruturado por módulo + arquivos, gerado async (job da Fase 8) com link de download expirante — portabilidade LGPD.
3. Encerramento de conta: soft com período de retenção configurável, exportação obrigatória oferecida, auditoria.

### 10.5 Polimento final (passada de qualidade em TUDO)

1. **Performance:** auditar N+1 nas telas de alto volume (agenda, recepção, fila de faturamento, kardex); índices compostos verificando `EXPLAIN` das 10 queries mais pesadas; paginação por cursor nas listas grandes; bundle: dynamic import nos módulos pesados (gráficos, editor).
2. **Testes E2E (Playwright, adicionar):** fluxos críticos ponta a ponta — (a) onboarding completo de organização nova; (b) agendar → confirmar por link → check-in → atender → prescrever → assinar → checkout → receber; (c) convênio: agendar com autorização → guia → lote → XML → conciliar com glosa; (d) agendamento online → aprovação → teleconsulta; (e) tentativa de acesso cross-tenant e cross-unidade (deve falhar). Rodáveis com `npm run test:e2e` contra banco de teste.
3. **Segurança:** revisar todas as rotas públicas (rate limit, headers, tokens expirando), rotação de chave PHI documentada (script de re-encrypt), dependências auditadas (`npm audit`), CSP no `next.config`.
4. **Acessibilidade:** navegação por teclado completa nas telas de recepção/agenda, labels e roles ARIA, contraste AA.
5. **A saúde do sistema:** página `/app/sistema` (ADMIN): status dos jobs, fila de mensagens com falha, último backup/exportação, versão; endpoint `/api/health` para monitoramento externo.
6. **Documentação final:** README.md reescrito como visão geral do produto completo (módulos, setup, deploy Vercel+Railway, crons, variáveis de ambiente); `docs/` com um guia por módulo; DECISOES.md consolidado; CHANGELOG.md por fase.

**Seed final:** organização demo completa com 2 unidades e dados ricos em todos os módulos, para demonstração comercial (`npm run db:seed:demo`).

## Entrega

`npx tsc --noEmit` limpo, `npm run build` verde, `npm test` e `npm run test:e2e` passando, migrations aplicáveis (backfill de unidade incluso), README.md com checklist manual da Fase 10 (trocar de unidade e ver filtros, criar perfil de permissão custom e testar bloqueio, trial → upgrade no checkout mock → limites aplicados, onboarding de org nova do zero, exportação completa, rodar E2E) e DECISOES.md atualizado. Se dividir (10A unidades+permissões, 10B billing+onboarding+ciclo de vida, 10C performance+E2E+segurança+docs), apresente o plano e execute na sequência.

Ao final, apresente um RELATÓRIO DE CONCLUSÃO: mapa de todos os módulos entregues, cobertura de testes, pendências conhecidas e recomendações de próximos passos comerciais (certificação SBIS, integração ICP-Brasil real, WhatsApp Business API, Stripe, provedores NFS-e).

Comece.
