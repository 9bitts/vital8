# PROMPT FASE 7 — ESTOQUE E COMPRAS (copiar e colar no Cursor após concluir a Fase 6)

---

Fase 6 validada. Execute agora a **FASE 7 — ESTOQUE E COMPRAS** completa, conforme o prompt mestre. Regra de ouro: saldo de estoque nunca é editado diretamente — todo saldo é derivado de movimentos auditados. Reforço do escopo e critérios de aceite:

## Escopo obrigatório

**Models (migrations incrementais):**
`Product` (nome, tipo MATERIAL/MEDICAMENTO/INSUMO/REVENDA, unidade de medida com fator de conversão compra→consumo — ex.: caixa 100un →un —, código de barras, estoque mínimo e máximo, custo médio calculado, preço de venda opcional para revenda, `isControlled` — portaria 344, com lista A/B/C —, exige lote/validade boolean, ativo), `StockLocation` (estoque central, salas/consultórios, geladeira — flag temperatura controlada), `StockBatch` (produto, número do lote, validade, quantidade por localização), `StockMovement` (tipos ENTRADA_COMPRA/ENTRADA_AJUSTE/SAIDA_CONSUMO/SAIDA_VENDA/SAIDA_PERDA/SAIDA_VENCIMENTO/TRANSFERENCIA/AJUSTE_INVENTARIO — sempre com produto, lote quando aplicável, localização origem/destino, quantidade, custo unitário, motivo obrigatório em ajustes e perdas, usuário, referência ao documento de origem: PurchaseOrder, Sale, Encounter, Inventory), `Supplier` (reaproveitar da Fase 5 — estender com prazo de entrega e condições), `PurchaseOrder` + `PurchaseOrderItem` (status RASCUNHO/ENVIADO/RECEBIDO_PARCIAL/RECEBIDO/CANCELADO, recebimento lança ENTRADA com lote/validade/custo e atualiza custo médio; recebimento parcial suportado; gera Payable na Fase 5 opcionalmente), `ServiceConsumptionKit` + itens (kit por Service: produtos e quantidades consumidos; baixa automática ao FINALIZAR Appointment — a partir da localização da sala, fallback central), `Inventory` + `InventoryCount` (inventário: congelar posição, contagem às cegas por localização, divergências geram AJUSTE_INVENTARIO auditado, status ABERTO/EM_CONTAGEM/FECHADO).

**Regras técnicas:**

1. Saldo = soma de movimentos (por produto/lote/localização), com agregado materializado para performance; consistência garantida por transação; teste de concorrência (duas saídas simultâneas não podem negativar).
2. Estoque negativo bloqueado por padrão (configurável por organização para permitir com alerta) — decisão documentada.
3. Consumo FEFO: baixa automática consome primeiro o lote com validade mais próxima.
4. Custo médio móvel recalculado a cada entrada; consumo registra custo do momento (para custo por procedimento).
5. Controlados (344): movimento de item controlado exige lote sempre, motivo e usuário; sem exclusão física de movimento (estorno = contra-movimento).
6. Alertas no centro de notificações: abaixo do mínimo, validade a vencer em 30/60/90 dias (configurável), item controlado com divergência de inventário.
7. Testes: saldo derivado, FEFO, conversão de unidade, custo médio, bloqueio de negativo, recebimento parcial, isolamento multi-tenant.

**Telas:**

1. `/app/estoque` — visão geral: alertas (mínimo, vencendo), valor total em estoque, últimos movimentos.
2. Produtos: CRUD com busca por nome/código de barras, saldo por localização e lote, kardex (extrato de movimentos com saldo corrente e filtros).
3. Movimentações: entrada avulsa, saída (consumo/perda com motivo), transferência entre localizações (leitura de código de barras via input com foco automático — fluxo de pistola USB).
4. Compras: pedido de compra (sugestão automática pelo estoque mínimo × consumo médio), envio (PDF por e-mail via adapter), recebimento conferindo item a item com lote/validade/custo, divergências destacadas.
5. Kits por serviço: configurar em Configurações → Serviços; ao finalizar atendimento, baixa automática com aviso na tela de checkout do que foi consumido (e possibilidade de ajustar antes de confirmar).
6. Inventário: abrir por localização, folha de contagem (imprimível), digitação às cegas, relatório de divergências, fechamento com ajustes.
7. Relatórios: curva ABC por valor consumido, consumo por profissional/procedimento/período, perdas por motivo, custo de material por atendimento (integra com margem: receita do serviço − custo do kit), **livro de controlados** (relatório de movimentação de itens 344 por período, com lote, saldo anterior/posterior, pronto para impressão).
8. Ficha do paciente/atendimento: materiais consumidos aparecem no detalhamento do atendimento.

**Permissões:** perfil ESTOQUE via permissão fina ou ADMIN; RECEPCAO só consulta; ajuste de inventário e perdas: ADMIN/OWNER ou permissão explícita; relatório de controlados: ADMIN/OWNER.

**Feature flag:** módulo habilitado em planos PRO/ENTERPRISE.

**Seed:** ~20 produtos (incluindo 2 controlados e itens com lote/validade), localizações (central + 2 salas), kits para 3 serviços, 1 pedido de compra recebido, movimentos históricos e 1 inventário fechado com divergência.

## Entrega

`npx tsc --noEmit` limpo, `npm run build` verde, `npm test` passando, migrations aplicáveis, README.md com checklist manual da Fase 7 (criar produto com lote, pedido de compra → receber parcial, finalizar atendimento com kit → conferir baixa FEFO, transferência, inventário com divergência, kardex, curva ABC, livro de controlados) e DECISOES.md atualizado. Se dividir (7A produtos+movimentos+kardex, 7B compras+kits+consumo automático, 7C inventário+relatórios+controlados), apresente o plano e execute na sequência.

Comece.
