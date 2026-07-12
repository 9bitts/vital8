# PROMPT FASE 9 — BI, INDICADORES E GESTÃO (copiar e colar no Cursor após concluir a Fase 8)

---

Fase 8 validada. Execute agora a **FASE 9 — BI, INDICADORES E GESTÃO** completa, conforme o prompt mestre. Esta fase transforma os dados das fases 2–8 em decisão: números confiáveis (batendo com os relatórios de origem), rápidos (sem N+1) e por papel. Reforço do escopo e critérios de aceite:

## Escopo obrigatório

**Camada de dados analíticos:**

1. Criar camada `src/modules/analytics/` com serviços de agregação. Estratégia: tabelas agregadas diárias (`DailyOrgMetrics`, `DailyProfessionalMetrics`) recalculadas pelo processador de jobs da Fase 8 (idempotente, reprocessável por intervalo) + queries diretas otimizadas para drill-down. Documentar a escolha e os índices criados em DECISOES.md.
2. Consistência: todo número do dashboard deve bater com o relatório do módulo de origem (mesmas regras de corte — competência × caixa, status considerados). Escrever testes que comparam agregado × cálculo direto num dataset de seed.
3. Fuso America/Sao_Paulo em todos os cortes de data; períodos comparativos (mês atual × anterior, ano × ano).

**Indicadores (mínimo):**

- **Produção:** atendimentos realizados, faltas e taxa de no-show, cancelamentos, taxa de ocupação da agenda (slots ocupados/disponíveis), tempo médio de espera (chegada → início), tempo médio de atendimento, atendimentos por origem (recepção/telefone/online).
- **Pacientes:** novos no período, ativos, taxa de retorno (retornaram em N dias por serviço), pacientes perdidos (sem atendimento há X meses), aniversariantes, NPS geral e por profissional.
- **Financeiro:** receita recebida × faturada, despesas, resultado, ticket médio, recebimento por forma de pagamento, inadimplência (valor e %), descontos concedidos, margem por serviço (receita − custo de kit da Fase 7 − comissão da Fase 5).
- **Convênios (TISS):** produção faturada × recebida por operadora, % de glosa, glosas recuperadas, prazo médio de pagamento.
- **Estoque:** valor imobilizado, perdas no período, itens críticos.

**Telas:**

1. `/app/dashboard` (substituir o atual): dashboard executivo para OWNER/ADMIN — cartões de KPI com variação vs período anterior, gráficos (receita diária, atendimentos semanais, ocupação por profissional, funil agendado→confirmado→atendido→pago), ranking de serviços e profissionais, filtro global de período e unidade. Usar Recharts (adicionar dependência).
2. Dashboard do PROFISSIONAL: própria produção, ocupação, no-show, NPS, extrato de repasse do período — nada de dados financeiros globais.
3. Dashboard da RECEPCAO: o dia de hoje — fila, confirmações pendentes, aniversariantes, agendamentos online a aprovar.
4. Central de relatórios `/app/relatorios`: catálogo de todos os relatórios das fases anteriores + novos, com filtros persistentes por usuário, exportação CSV e PDF (layout com cabeçalho da clínica), agendamento de envio por e-mail (régua da Fase 8 — ex.: resumo semanal para o OWNER toda segunda 7h).
5. **Metas:** configurar meta mensal por organização e por profissional (receita, atendimentos, novos pacientes, NPS); acompanhamento com barra de progresso e projeção linear do fechamento; notificação a 80%/100%.
6. **Centro de notificações** (sino no header, consolidando as fases): estoque mínimo/validade, glosas recebidas, detratores NPS, metas, caixa não fechado, lote TISS parado, contas a vencer; preferências por usuário (in-app/e-mail); marcar como lida; badge de contagem.
7. Exportação: todo gráfico com "ver dados" (tabela) e download CSV.

**Regras técnicas:**

1. Todas as queries analíticas via `tenantClient` ou com filtro explícito de org auditado; teste de isolamento nos agregados (org A nunca vê métrica da org B).
2. Performance: dashboards carregam < 2s no dataset do seed; usar `Promise.all`, cache curto (revalidate) e índices — listar em DECISOES.md.
3. Acessibilidade nos gráficos: cores com contraste, valores nos tooltips, tabela alternativa.
4. Testes: agregação diária idempotente e reprocessável, comparativo período, cálculo de margem, metas/projeção, isolamento.

**Permissões:** dashboards por papel conforme acima; FINANCEIRO vê o executivo sem dados clínicos; relatório com dado clínico (ex.: CID mais frequentes — incluir como relatório epidemiológico agregado e anonimizado) apenas ADMIN/OWNER/PROFISSIONAL. **Feature flag:** BI completo em PRO/ENTERPRISE (BASICO vê dashboard simples do dia).

**Seed:** enriquecer o seed com ~6 meses de histórico distribuído (atendimentos, pagamentos, guias, consumo de estoque, NPS) para os dashboards e comparativos fazerem sentido visual — pode ser um script gerador determinístico (`prisma/seed-analytics.ts`).

## Entrega

`npx tsc --noEmit` limpo, `npm run build` verde, `npm test` passando, migrations aplicáveis, README.md com checklist manual da Fase 9 (dashboard executivo com comparativo, dashboard do profissional restrito, relatório exportado em CSV/PDF, resumo semanal agendado, meta com projeção, notificações com preferências, reprocessar agregados de um intervalo) e DECISOES.md atualizado. Se dividir (9A camada analítica+agregados, 9B dashboards por papel, 9C relatórios+metas+notificações), apresente o plano e execute na sequência.

Comece.
