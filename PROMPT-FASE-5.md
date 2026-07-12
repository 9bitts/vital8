# PROMPT FASE 5 — FINANCEIRO (copiar e colar no Cursor após concluir a Fase 4)

---

Fase 4 validada. Execute agora a **FASE 5 — FINANCEIRO** completa, conforme o prompt mestre. Todo cálculo de dinheiro exige teste unitário; valores monetários sempre em centavos (inteiros), nunca float. Reforço do escopo e critérios de aceite:

## Escopo obrigatório

**Models (migrations incrementais):**
`PriceTable` + `PriceTableItem` (tabela PARTICULAR padrão + tabelas por convênio: preço por Service, vigência início/fim), `Sale` (venda ao paciente: itens de serviço, pacote ou produto avulso; desconto com motivo e usuário autorizador; status), `Package` + `PackagePurchase` + `PackageSessionConsumption` (pacote de N sessões com preço fechado; consumo debita ao FINALIZAR o Appointment vinculado; saldo visível), `Receivable` (contas a receber: origem — venda, avulso —, parcelas com vencimento, status ABERTO/PARCIAL/PAGO/VENCIDO/CANCELADO), `Payment` (recebimento: forma DINHEIRO/PIX/DEBITO/CREDITO/TRANSFERENCIA/LINK, parcelas do cartão, taxa da adquirente % e valor líquido calculado, data de crédito prevista), `Payable` (contas a pagar: fornecedor, categoria, competência, vencimento, recorrência mensal, anexo do comprovante), `Supplier`, `FinancialCategory` (plano de contas simples em árvore de 2 níveis, receitas e despesas, seed inicial), `BankAccount`, `CashRegister` + `CashRegisterEntry` (caixa da recepção: abertura com fundo de troco, entradas/saídas vinculadas a Payment, sangria e reforço com motivo, fechamento com conferência cego — usuário informa contado, sistema mostra diferença), `CommissionRule` (regra de repasse por profissional: percentual ou valor fixo, por serviço específico ou geral, base FATURADO ou RECEBIDO, particular × convênio), `CommissionStatement` + itens (fechamento mensal por profissional: apuração automática, status ABERTO/FECHADO/PAGO, trava após fechamento, recibo em PDF), `Refund` (estorno com motivo, permissão e auditoria).

**Regras técnicas:**

1. Centavos inteiros em todo o schema; formatação R$ apenas na UI. Helpers de dinheiro centralizados (`src/lib/money.ts`) com testes (rateio de desconto entre itens, arredondamento de parcelas — soma das parcelas = total exato).
2. Fluxo principal: Appointment FINALIZADO gera pendência de checkout na recepção → Sale → Receivable → Payment no caixa aberto. Nada de cobrança dupla: Appointment referencia a Sale.
3. Pacote: comprar gera Sale + Receivable; cada sessão consumida debita saldo; cancelamento de pacote calcula valor proporcional (regra configurável).
4. Comissão: apuração por período considerando base FATURADO ou RECEBIDO conforme regra; desconto reduz base proporcionalmente; fechamento trava os itens (novos lançamentos retroativos caem no período seguinte). Testes: percentual, fixo, base recebida com pagamento parcial, desconto rateado.
5. Estorno: exige ADMIN/OWNER ou permissão, motivo obrigatório, reabre Receivable, lança saída no caixa se dinheiro; tudo auditado.
6. Adapters: `nfse` (`src/lib/integrations/nfse/` — emitir NFS-e mock com numeração sequencial e PDF simples; interface pronta para eNotas/Focus) e `payments` (link de pagamento/PIX copia-e-cola mock com página pública de status; interface pronta para gateway real).
7. Tudo via `tenantClient` + teste de isolamento para Sale/Receivable/Payment; toda mutação financeira auditada.

**Telas:**

1. `/app/financeiro` — dashboard do módulo: a receber hoje/semana, vencidos, caixa aberto, recebido no mês, contas a pagar próximas.
2. Checkout na recepção: ao finalizar atendimento, botão "Receber" — itens pré-carregados (serviço do agendamento pelo preço da tabela do convênio/particular), adicionar itens, desconto (com permissão), escolher forma, parcelar, receber no caixa; emitir NFS-e (adapter) e recibo em PDF.
3. Caixa: abrir (fundo de troco), movimentos do dia em tempo real, sangria/reforço, fechamento cego com relatório de diferença; histórico de caixas por usuário.
4. Contas a receber: lista com filtros (status, vencimento, paciente, convênio), baixa manual, baixa parcial, renegociação de parcelas; régua de cobrança: lembretes automáticos de vencidos via adapter de mensageria (H+1, H+7, configurável) com opt-out.
5. Contas a pagar: CRUD com recorrência, anexos, baixa; visão semanal de compromissos.
6. Fluxo de caixa: realizado + projetado por dia/semana/mês (recebíveis previstos + pagáveis), saldo acumulado, gráfico.
7. DRE simplificada mensal: receitas − despesas por categoria (árvore), comparativo com mês anterior, exportar CSV.
8. Repasse: tela de regras por profissional; apuração do período com detalhamento item a item; fechar → PDF do extrato; marcar como pago (gera Payable opcional).
9. Pacotes: catálogo, venda, acompanhamento de saldo por paciente (visível também na ficha do paciente e no agendamento).
10. Relatórios: faturamento por profissional/serviço/convênio/forma de pagamento, ticket médio, descontos concedidos por usuário, estornos. Exportar CSV.
11. Linha do tempo do paciente passa a exibir vendas e pagamentos.

**Permissões:** RECEPCAO opera caixa e checkout (desconto até limite configurável); FINANCEIRO tudo do módulo sem conteúdo clínico; fechamento de comissão, estorno acima do limite e edição de regras: ADMIN/OWNER. PROFISSIONAL vê apenas o próprio extrato de repasse.

**Seed:** tabela de preços particular + uma de convênio; regras de comissão para os profissionais; ~20 vendas/recebimentos históricos (incluindo parcelados, vencidos, um pacote com sessões consumidas) para alimentar fluxo de caixa, DRE e repasse.

## Entrega

`npx tsc --noEmit` limpo, `npm run build` verde, `npm test` passando (dinheiro, parcelas, comissão, pacote, isolamento), migrations aplicáveis, README.md com checklist manual da Fase 5 (abrir caixa, finalizar atendimento → checkout com desconto → receber parcelado, sangria, fechamento cego com diferença, régua de cobrança, apurar e fechar repasse, DRE) e DECISOES.md atualizado. Se dividir (5A vendas+caixa+recebíveis, 5B pagáveis+fluxo+DRE, 5C comissão+pacotes+relatórios), apresente o plano e execute na sequência.

Comece.
