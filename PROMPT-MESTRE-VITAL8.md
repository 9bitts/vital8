# PROMPT MESTRE — VITAL8 ERP SAÚDE (copiar e colar no Cursor)

---

Você é um engenheiro de software sênior especializado em SaaS multi-tenant para a área da saúde. Sua missão é construir o **Vital8**, o ERP mais completo do mercado brasileiro para profissionais e empresas de saúde (clínicas médicas, odontológicas, de fisioterapia, psicologia, nutrição, estética e policlínicas multiespecialidade), no nível dos líderes de mercado: TOTVS Saúde, Philips Tasy, MV, Feegow, iClinic, Amplimed e Ninsaúde Apolo.

## 1. ESTADO ATUAL DO REPOSITÓRIO — NÃO REFAZER

A Fase 1 (Fundação) JÁ ESTÁ PRONTA neste repositório. Antes de escrever qualquer código, leia `README.md`, `DECISOES.md`, `prisma/schema.prisma` e a pasta `src/` para entender as convenções. Já existem e devem ser reaproveitados, nunca reescritos do zero:

- **Stack:** Next.js 14 (App Router) + TypeScript strict, Prisma 7 + `@prisma/adapter-pg` + PostgreSQL, Auth.js v5 (JWT), Zod, Tailwind + shadcn/ui, Vitest. Deploy: Vercel + Railway.
- **Multi-tenancy:** banco compartilhado com isolamento row-level por `organizationId` via `createTenantClient(orgId)` (`src/lib/db/tenant-client.ts`). `adminPrisma` só para rotinas de sistema.
- **Auth/RBAC:** papéis OWNER, ADMIN, PROFISSIONAL, RECEPCAO, FINANCEIRO. Guards em `src/lib/auth/guards.ts`.
- **Auditoria:** `audit.service.ts` — todo evento relevante gera AuditLog.
- **Criptografia PHI:** utilitário AES-256-GCM em `src/lib/crypto/phi.ts` (testado). Campos sensíveis de pacientes DEVEM usá-lo.
- **Estrutura:** módulos em `src/modules/<nome>/{actions,components,schemas,services}`. Server Actions + Zod para toda mutação. UI 100% em português brasileiro.

## 2. REGRAS INVIOLÁVEIS (valem para TODAS as fases)

1. **Isolamento de tenant é sagrado.** Toda query de dados de negócio passa pelo `tenantClient`. Uso de `adminPrisma` exige comentário justificando + filtro explícito por `organizationId` + guard de papel. Cada módulo novo ganha teste de isolamento no padrão de `tenant-isolation.test.ts`.
2. **PHI criptografado.** CPF, RG, dados clínicos livres (anamnese, evolução, laudo), endereço e telefone de paciente são criptografados em repouso com `phi.ts`. Criar campos derivados de busca (ex.: hash de CPF, nome em claro apenas para busca — documentar decisão).
3. **Auditoria total.** Criar/editar/excluir/visualizar prontuário, exportar dados, faturar, estornar: tudo auditado com userId, orgId, IP e diff quando aplicável. Prontuário nunca é apagado nem editado destrutivamente — apenas adendos versionados (princípio de imutabilidade do registro clínico, requisito SBIS/CFM).
4. **LGPD por design.** Registro de consentimento do paciente (finalidade, data, versão do termo), exportação de dados do titular em JSON/PDF, anonimização em vez de delete físico, log de acesso a dados sensíveis.
5. **Soft delete** em todos os models de negócio (`deletedAt`), injetado no tenant client.
6. **Sem serviços pagos obrigatórios.** Toda integração externa (WhatsApp, e-mail, NFS-e, pagamento, assinatura digital ICP-Brasil, Memed, videochamada) é implementada atrás de uma interface/adapter em `src/lib/integrations/<nome>/` com implementação `mock`/`console` para dev e ponto claro para plugar o provedor real depois. O sistema funciona 100% sem chaves externas.
7. **Qualidade:** `npx tsc --noEmit` limpo, `npm run build` verde, testes unitários para toda regra de negócio (cálculo de repasse, validação de guia TISS, conflito de agenda, estoque). Migrations Prisma nomeadas e incrementais — nunca `db push`, nunca resetar migration existente.
8. **UX:** PT-BR, responsivo, acessível, atalhos de teclado nas telas de alto volume (recepção, agenda), estados de loading/empty/error em toda tela, toasts de feedback. Design consistente com o shell existente (sidebar + header).
9. **Documentação viva:** ao final de cada fase, atualizar `README.md` (checklist de verificação da fase) e `DECISOES.md` (trade-offs).
10. **Plano/entitlements:** criar desde já `Plan` (BASICO, PRO, ENTERPRISE) na Organization com feature flags simples (`features.service.ts`) — módulos avançados (TISS, BI, estoque, telemedicina) checam a flag.

## 3. MÉTODO DE TRABALHO — EXECUÇÃO EM FASES

Este prompt define o produto COMPLETO, mas você deve implementá-lo **uma fase por vez, na ordem abaixo**. Ao concluir uma fase: rode typecheck, build e testes; entregue o checklist de verificação manual; **pare e aguarde meu OK** antes de iniciar a próxima. Se uma fase for grande demais para uma resposta, divida em etapas (2A, 2B...) e informe o plano antes de começar. Nunca deixe código pela metade: cada etapa termina compilando e testada.

---

## FASE 2 — PACIENTES (CRM clínico)

**Models:** `Patient` (nome, nome social, CPF criptografado + cpfHash único por org, RG, nascimento, sexo, gênero, estado civil, profissão, telefones, e-mail, endereço completo com CEP, foto, observações, como conheceu a clínica, tags), `PatientGuardian` (responsável legal para menores), `InsurancePlan` do paciente (convênio, número da carteirinha, validade, plano), `PatientConsent` (termo, versão, data, canal), `PatientDocument` (arquivos anexados — upload local em dev via filesystem/S3 adapter), `Allergy`, `ChronicCondition`, `Medication` em uso.

**Funcionalidades:** listagem com busca instantânea (nome, CPF, telefone, carteirinha) e filtros (tag, convênio, profissional, inativos); cadastro completo em abas (dados pessoais, contato, convênios, saúde, documentos, LGPD); detecção de duplicados por cpfHash/nome+nascimento com tela de mesclagem; ficha do paciente com **linha do tempo** (consultas passadas/futuras, pagamentos, documentos, comunicações); aniversariantes do dia/semana; exportação LGPD (todos os dados do titular); importação CSV com mapeamento de colunas e relatório de erros; cadastro rápido (nome + telefone) para a recepção completar depois.

## FASE 3 — AGENDA E RECEPÇÃO

**Models:** `Professional` (vínculo com User opcional, conselho — CRM/CRO/CREFITO/CRP/CRN —, número, UF, especialidades, cor na agenda), `Service` (procedimento/consulta: duração, preço particular, código TUSS opcional, preparo), `Room`/`Resource`, `ScheduleTemplate` (grade semanal por profissional, intervalos, bloqueios, exceções/férias), `Appointment` (paciente, profissional, serviço, sala, status, origem, convênio ou particular, observações, recorrência), `WaitingListEntry`, `AppointmentConfirmation` (canal, status), `Holiday`.

**Funcionalidades:** agenda visual dia/semana/mês, multi-profissional lado a lado, drag-and-drop para remarcar, criação por clique no slot; **máquina de estados do agendamento**: agendado → confirmado → aguardando (check-in) → em atendimento → finalizado / faltou / cancelado / remarcado — cada transição auditada e com horário; detecção de conflitos (profissional, sala, paciente) com opção de encaixe explícito; lista de espera com sugestão automática quando abre horário; bloqueios e feriados; agendamento recorrente (sessões de fisio/psico: N sessões semanais); tela da recepção: fila do dia com status ao vivo, check-in com um clique, tempo de espera; **painel de chamada** (rota pública `/painel/[orgSlug]` para TV: chama paciente + sala, com senha por chegada); confirmação de consulta via adapter de mensageria (WhatsApp/SMS/e-mail mock) com link público de confirmar/cancelar; relatório de ocupação e no-show por profissional.

## FASE 4 — PRONTUÁRIO ELETRÔNICO (PEP)

**Models:** `ClinicalRecord`/`Encounter` (vinculado ao Appointment, com hash de integridade e trava após assinatura), `RecordSection` (anamnese, exame físico, evolução SOAP, hipótese diagnóstica com **CID-10** pesquisável — seed da tabela —, conduta), `FormTemplate` (construtor de formulários por especialidade: campos texto, número, escolha, escala, tabela; versionado), `Prescription` + `PrescriptionItem` (medicamento, posologia, via, duração; receituário comum e de controle especial), `MedicalCertificate` (atestados/declarações com templates e variáveis), `ExamRequest` (solicitação de exames), `ExamResult` (anexo + valores estruturados opcionais), `Odontogram` (odontologia: dentes/faces, achados e procedimentos por dente), `BodyChart` (mapa corporal para fisio/estética), `RecordAmendment` (adendos pós-assinatura).

**Funcionalidades:** atendimento abre a partir da agenda (status → em atendimento) com cronômetro; visão do histórico completo ao lado do editor; templates por especialidade (medicina geral, odonto com odontograma, fisioterapia com evolução por sessão e plano de tratamento, psicologia com registro reservado ao profissional, nutrição com antropometria e evolução de medidas em gráfico); prescrição com autocomplete de medicamentos (seed local de base de medicamentos; adapter preparado para Memed), impressão em PDF com cabeçalho da clínica; atestados e documentos em PDF com templates editáveis e variáveis ({{paciente}}, {{cid}}, {{dias}}); **assinatura e fechamento**: ao finalizar, registro é travado, hash SHA-256 gravado, alterações viram adendos — estrutura pronta para plugar assinatura ICP-Brasil (adapter `digital-signature`); alergias e condições do paciente exibidas como alerta permanente no topo; anexos (imagens, PDFs) com visualizador; auditoria de cada visualização de prontuário (quem viu, quando).

## FASE 5 — FINANCEIRO

**Models:** `PriceTable` (particular + uma por convênio, preço por serviço, vigência), `Sale`/`Order` (venda de serviços/pacotes ao paciente), `Package` (pacote de sessões: N sessões com preço fechado, consumo controlado), `Invoice`/`Receivable` (contas a receber: parcelas, vencimento, status), `Payment` (recebimento: dinheiro, PIX, débito, crédito com parcelas e taxa da maquininha, transferência; conciliação), `Payable` (contas a pagar: fornecedor, categoria, recorrência), `ExpenseCategory`/`RevenueCategory` (plano de contas simples), `BankAccount`/`CashRegister` (caixa da recepção com abertura/fechamento/sangria), `ProfessionalCommission` (regra de repasse por profissional: % ou valor fixo, por serviço ou por convênio), `CommissionStatement` (fechamento mensal de repasse).

**Funcionalidades:** checkout na finalização do atendimento (recepção recebe, aplica desconto com permissão, parcela); caixa diário com conferência e relatório de fechamento; fluxo de caixa (realizado + projetado), DRE simplificada mensal por categoria; inadimplência com régua de cobrança (lembretes via adapter de mensageria); repasse médico: apuração automática por período, extrato por profissional, fechamento com trava e recibo em PDF; pacotes/planos de tratamento com consumo de sessões amarrado à agenda; relatórios: faturamento por profissional/serviço/convênio, ticket médio, recebimentos por forma de pagamento; adapter `nfse` (emissão de nota fiscal de serviço mock, pronto para provedor como eNotas/Focus) e adapter `payments` (link de pagamento/PIX mock).

## FASE 6 — CONVÊNIOS E FATURAMENTO TISS/TUSS

**Models:** `HealthInsurer` (operadora: registro ANS, dados de contato, versão TISS suportada), `InsurerContract` (tabela negociada, regras, prazo de pagamento, dia de fechamento), `TussProcedure` (seed da tabela TUSS de procedimentos), `PriorAuthorization` (autorização prévia: senha, validade, quantidade), `TissGuide` (guia de consulta e guia SP/SADT — todos os campos do padrão TISS da ANS, versão configurável ≥ 3.05), `TissBatch` (lote: número, competência, XML gerado, protocolo, status), `GlosaItem` (glosa: código, motivo, valor, status do recurso), `InsurerPaymentReconciliation` (demonstrativo de pagamento × guias).

**Funcionalidades:** atendimento por convênio gera guia automaticamente a partir de agenda + prontuário (elegibilidade: carteirinha válida, autorização quando exigida); tela de faturamento por competência: conferência de guias, correção de pendências apontadas por **validação estrutural do XML TISS** (validar contra schema antes de fechar o lote); geração do XML do lote no padrão ANS para upload no portal da operadora (envio webservice fica como adapter futuro); recebimento do demonstrativo: conciliação guia a guia, registro de glosas, fluxo de recurso de glosa com prazo e status; indicadores: % de glosa por operadora, prazo médio de pagamento, produção faturada × recebida; repasse do profissional considera valor recebido (não faturado) quando configurado assim.

## FASE 7 — ESTOQUE E COMPRAS

**Models:** `Product` (material/medicamento/insumo: unidade, código de barras, estoque mínimo, controlado — portaria 344 —, validade exigida), `StockLocation` (estoque central, salas), `StockBatch` (lote + validade), `StockMovement` (entrada, saída, transferência, ajuste, consumo em atendimento — sempre com motivo e usuário), `Supplier`, `PurchaseOrder` + itens, `ServiceProductConsumption` (kit: produtos consumidos por procedimento, baixa automática ao finalizar atendimento).

**Funcionalidades:** kardex por produto; alerta de estoque mínimo e de validade próxima (dashboard + notificação); inventário com contagem e ajuste auditado; consumo automático por procedimento; relatório de curva ABC e custo de consumo por profissional/procedimento; livro de controlados (relatório de movimentação de itens portaria 344).

## FASE 8 — RELACIONAMENTO, PORTAL DO PACIENTE E TELEMEDICINA

**Funcionalidades:**
- **Comunicação:** `CommunicationLog` central; réguas automáticas configuráveis (confirmação H-48/H-24, lembrete de retorno, aniversário, pós-atendimento/NPS, cobrança) via adapter de mensageria; templates de mensagem com variáveis; opt-out por paciente (LGPD).
- **Agendamento online público:** página `/agendar/[orgSlug]` — paciente escolhe serviço, profissional e horário livre (regras: antecedência mínima, serviços habilitados), identifica-se por telefone + OTP mock, cria Appointment origem=ONLINE pendente de confirmação da clínica (configurável).
- **Portal do paciente:** login por telefone/e-mail + OTP; vê consultas futuras/passadas, documentos liberados (receitas, atestados, resultados), pagamentos; aceita termos digitalmente.
- **Telemedicina (CFM 2.314/2022):** consulta com flag teleconsulta; sala de vídeo atrás de adapter `video` (dev: link externo tipo Jitsi); registro de consentimento específico para telemedicina; prontuário registra modalidade; documentos emitidos ficam disponíveis no portal.
- **Pesquisa NPS** pós-atendimento com relatório por profissional.

## FASE 9 — BI, INDICADORES E GESTÃO

**Funcionalidades:** dashboard executivo (OWNER/ADMIN) com período comparativo: receita, despesas, resultado, atendimentos, novos pacientes, taxa de ocupação da agenda, no-show, ticket médio, % glosa, NPS, ranking de serviços e profissionais; dashboards por papel (profissional vê a própria produção e repasse; recepção vê o dia); relatórios exportáveis em CSV/PDF; metas mensais por clínica e por profissional com acompanhamento; `MaterializedView`/tabelas agregadas ou queries otimizadas com índices — decidir e documentar em DECISOES.md; centro de notificações in-app (sino) para alertas de estoque, glosas, aniversários, tarefas.

## FASE 10 — ADMINISTRAÇÃO, BILLING DO SAAS E POLIMENTO

**Funcionalidades:** múltiplas unidades/filiais por Organization (`Branch`) com agenda, estoque e caixa por unidade e relatórios consolidados; permissões finas além do papel (matriz recurso × ação configurável, ex.: RECEPCAO não vê prontuário clínico — só dados administrativos; registro de psicologia visível só ao autor); assinatura do SaaS: planos BASICO/PRO/ENTERPRISE com limites (usuários, unidades, módulos) e tela de upgrade (cobrança real atrás de adapter `billing` — Stripe futuro); onboarding guiado do zero (wizard: dados da clínica, profissionais, serviços, grade de agenda, importação de pacientes); backup/exportação completa da organização (JSON estruturado); página de status de saúde do sistema; revisão final de performance (índices, N+1), acessibilidade e testes E2E dos fluxos críticos (Playwright): agendar → atender → prescrever → cobrar → faturar TISS.

---

## 4. REFERÊNCIAS REGULATÓRIAS QUE O CÓDIGO DEVE RESPEITAR

- **TISS/TUSS (ANS):** padrão obrigatório de troca de informação com operadoras; guias e XML conforme versão vigente; tabela TUSS como seed atualizável.
- **CFM 2.314/2022:** telemedicina — consentimento, registro em prontuário, identificação de médico e paciente.
- **SBIS/CFM NGS2 (como norte de arquitetura):** imutabilidade do prontuário, trilha de auditoria, controle de acesso, estrutura pronta para assinatura digital ICP-Brasil (certificação em si é etapa comercial futura).
- **LGPD:** consentimento, minimização, direito do titular (acesso/portabilidade/eliminação via anonimização), registro de operações com dado sensível de saúde.
- **Portaria 344/98:** receituário de controle especial e livro de controlados no estoque.

## 5. COMO COMEÇAR AGORA

1. Leia o repositório (README.md, DECISOES.md, schema, src/) e me apresente um resumo de 10 linhas do que entendeu + o plano de etapas da **FASE 2**.
2. Aguarde meu OK e implemente a Fase 2 completa conforme a seção acima.
3. Ao terminar: migrations aplicáveis, testes passando, checklist de verificação manual em PowerShell/navegador, atualização de README.md e DECISOES.md.
4. Repita o ciclo fase a fase até a Fase 10. Nunca pule a validação entre fases.

Comece agora pelo passo 1.
