# PROMPT FASE 6 — CONVÊNIOS E FATURAMENTO TISS/TUSS (copiar e colar no Cursor após concluir a Fase 5)

---

Fase 5 validada. Execute agora a **FASE 6 — CONVÊNIOS E FATURAMENTO TISS/TUSS** completa, conforme o prompt mestre. O padrão TISS é norma da ANS: a estrutura das guias e do XML deve seguir fielmente o schema oficial (versão configurável, padrão 3.05.00 ou superior). Reforço do escopo e critérios de aceite:

## Escopo obrigatório

**Models (migrations incrementais):**
`HealthInsurer` (operadora: nome, registro ANS, CNPJ, versão TISS suportada, código na operadora do prestador, dados de contato, prazo de pagamento em dias, dia de fechamento de lote, exige autorização por tipo de procedimento, ativo), `InsurerContract` (vincula operadora à PriceTable da Fase 5, vigência, regras de reajuste anotadas), `TussProcedure` (seed da tabela TUSS de procedimentos — subset representativo de consultas e procedimentos comuns, estrutura completa: código, termo, importável por CSV para atualização), vincular `Service` ↔ código TUSS (obrigatório para faturar convênio), `PriorAuthorization` (guia de autorização: senha, data de validade, quantidade autorizada/consumida, status SOLICITADA/AUTORIZADA/NEGADA/EXPIRADA, anexos), `TissGuide` (tipos GUIA_CONSULTA e GUIA_SP_SADT com TODOS os campos do padrão: número da guia no prestador, registro ANS, dados do beneficiário — carteirinha, validade, nome —, dados do contratado executante — CNES, CNPJ/CPF, conselho —, profissional executante, indicação de acidente, caráter do atendimento, tipo de consulta, procedimentos executados com código TUSS/quantidade/valor, data/hora, CID opcional conforme regra, status RASCUNHO/PRONTA/EM_LOTE/ENVIADA/PAGA/GLOSADA_PARCIAL/GLOSADA_TOTAL), `TissBatch` (lote: número sequencial por operadora, competência, hash do XML, XML armazenado via storage adapter, protocolo de envio, data de envio, status), `GlosaItem` (por guia/procedimento: código de glosa, motivo, valor glosado, status ACEITA/EM_RECURSO/RECUPERADA/PERDIDA, prazo do recurso, justificativa do recurso, anexos), `InsurerPayment` (demonstrativo: data, valor bruto, descontos, valor líquido, conciliação guia a guia).

**Regras técnicas:**

1. **Geração da guia:** Appointment de convênio FINALIZADO gera TissGuide automaticamente (dados do paciente/carteirinha da Fase 2, profissional/conselho da Fase 3, procedimentos e CID do Encounter da Fase 4, valores da PriceTable do convênio da Fase 5). Elegibilidade verificada no agendamento e no check-in: carteirinha válida, autorização quando exigida — alerta na recepção.
2. **Validação estrutural:** antes de fechar o lote, validar cada guia (campos obrigatórios por tipo, código TUSS existente, carteirinha, autorização vigente quando exigida) e o XML gerado contra o schema TISS (armazenar XSDs da versão em `src/lib/tiss/schemas/`). Erros listados campo a campo na UI, guia bloqueada até correção.
3. **XML do lote** no padrão ANS (`ans.gov.br/padroes/tiss/schemas`): cabeçalho com identificação do prestador e operadora, hash conforme especificação (epílogo `<hash>` MD5 do conteúdo, conforme padrão TISS), download do arquivo para upload no portal da operadora. Envio por webservice fica atrás do adapter `tiss-transport` (mock em dev).
4. **Conciliação:** lançar demonstrativo de pagamento da operadora → conciliar guia a guia (pago integral, parcial com glosa, não pago); glosa gera GlosaItem; recebimento integra com Receivable/Payment da Fase 5 (o convênio é o devedor — criar Receivable por lote enviado); repasse do profissional com base RECEBIDO usa o valor conciliado.
5. Numerações sequenciais por organização+operadora (guia e lote) sem colisão — transação com lock; testes.
6. Testes: geração de guia a partir do fluxo completo, validações de campos obrigatórios, XML válido contra XSD, hash do lote, numeração sequencial concorrente, conciliação com glosa parcial, isolamento multi-tenant.

**Telas:**

1. Configurações → Convênios: CRUD de operadoras (registro ANS, versão TISS, regras), vínculo com tabela de preços, mapeamento Service ↔ TUSS com busca, importação CSV da TUSS.
2. Central de autorizações: pedidos pendentes, registrar senha/validade/quantidade, alertas de expiração; visível também no agendamento (badge "requer autorização").
3. `/app/faturamento`: fila de guias por competência e operadora com status e pendências de validação (corrigir inline); selecionar guias → gerar lote → revisar → fechar (gera XML, baixa arquivo); reabrir lote não enviado (com auditoria).
4. Impressão da guia no layout padrão TISS (PDF) para operadoras que exigem papel.
5. Conciliação: lançar demonstrativo, tela lado a lado (demonstrativo × guias do lote), aplicar pagamentos e glosas em massa, divergências destacadas.
6. Gestão de glosas: fila por status, iniciar recurso com justificativa e prazo, acompanhar resultado; motivo de glosa padronizado (seed de códigos comuns).
7. Indicadores do módulo: % de glosa por operadora, prazo médio de pagamento real × contratado, produção faturada × recebida por competência, guias paradas em pendência.
8. Ficha do paciente e checkout (Fase 5) reconhecem atendimento por convênio: sem cobrança do paciente exceto coparticipação configurável.

**Permissões:** FINANCEIRO/ADMIN/OWNER operam faturamento e conciliação; RECEPCAO vê elegibilidade e autorizações; PROFISSIONAL nada além da própria produção.

**Feature flag:** módulo TISS habilitado apenas em planos PRO/ENTERPRISE (`features.service.ts`).

**Seed:** 2 operadoras fictícias (versões TISS diferentes), mapeamento TUSS dos serviços existentes, ~10 guias em vários status, 1 lote fechado com XML, 1 demonstrativo conciliado com glosa em recurso.

## Entrega

`npx tsc --noEmit` limpo, `npm run build` verde, `npm test` passando, migrations aplicáveis, README.md com checklist manual da Fase 6 (agendar por convênio com autorização, finalizar → guia gerada, corrigir pendência, fechar lote e baixar XML, validar XML contra XSD, conciliar demonstrativo com glosa, abrir recurso, conferir indicadores) e DECISOES.md atualizado (incluindo versão TISS adotada e estratégia de atualização de schemas). Se dividir (6A operadoras+TUSS+autorizações, 6B guias+validação+lote/XML, 6C conciliação+glosas+indicadores), apresente o plano e execute na sequência.

Comece.
