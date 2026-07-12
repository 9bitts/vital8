# PROMPT — FASE 16: EXCELÊNCIA DE MERCADO (copiar e colar no Cursor)

---

Você é um engenheiro de software sênior especializado em SaaS multi-tenant para saúde. O **Vital8** já tem as Fases 1–15 entregues (pacientes, agenda, PEP, financeiro, TISS, estoque, relacionamento, BI, admin/billing, API pública, IA, FHIR/RNDS, PWA mobile, marketing). Esta fase fecha os gaps identificados em benchmark contra os líderes do mercado brasileiro (TOTVS Saúde, Philips Tasy, MV Soul, Feegow, iClinic, Amplimed, Ninsaúde Apolo) e contra exigências regulatórias vigentes em 2026.

## REGRAS (herdadas do PROMPT-MESTRE — invioláveis)

- Leia antes: `README.md`, `DECISOES.md`, `SECURITY-BACKLOG.md`, `prisma/schema.prisma`.
- Isolamento por `createTenantClient(orgId)`; `adminPrisma` só com justificativa + filtro explícito.
- PHI criptografado (`src/lib/crypto/phi.ts`), auditoria total, soft delete, LGPD by design.
- Integrações externas SEMPRE atrás de adapter em `src/lib/integrations/<nome>/` com mock funcional — o sistema roda 100% sem chaves.
- Migrations incrementais nomeadas, nunca `db push`. `tsc --noEmit` limpo, `npm run build` verde, teste de isolamento por módulo novo.
- UI PT-BR, responsiva, estados loading/empty/error, feature flags por plano em `features.service.ts`.
- Execute **uma etapa por vez, na ordem abaixo**; ao fim de cada etapa rode typecheck + build + testes, entregue checklist de verificação manual e **pare aguardando meu OK**.

---

## ETAPA 16A — SEGURANÇA: ZERAR O BACKLOG CRÍTICO (pré-requisito de tudo)

Implementar todos os itens 🔴 e ⚠️ do `SECURITY-BACKLOG.md`:

1. **Multi-unidade completa (A-04):** aplicar `branchFilter` em `searchPatients`, leads, caixa, estoque, financeiro e relatórios; validar `branchId` pertencente à org em toda mutação; teste E2E "usuário da unidade A não vê dados da unidade B".
2. **Revogação de JWT (B-04):** campo `sessionVersion` em `User`/`Membership`, incrementado ao desativar membro, trocar senha ou papel; validado no callback do Auth.js; `maxAge` 8h. Teste de integração.
3. **HMAC obrigatório (B-06):** em produção, `X-Vital8-Signature` obrigatório em POST/PUT/PATCH/DELETE da API v1; rejeitar ausente com 401.
4. Demais itens ⚠️: mensagem genérica no signup (B-05), assinatura real + idempotência em DB no webhook billing (E-04), CSP com nonce (F-02), redact de logs sensíveis (C-06/C-07), bloqueio de escalonamento de papel via convite (G-04) com teste, revisão de redaction no export LGPD (H-05).
5. Completar os 4 testes de regressão pendentes listados no backlog.

## ETAPA 16B — TISS 4.03 (OBRIGATÓRIO PELA ANS A PARTIR DE JUL/2026)

O Vital8 hoje gera XML na versão 3.05.00 — **isso invalida o faturamento a partir de 01/07/2026**.

1. Refatorar `src/lib/tiss/` para suportar **múltiplas versões do padrão** (strategy por versão: schemas, builder, validator). `HealthInsurer.tissVersion` já indica a versão por operadora — respeitá-la.
2. Implementar a versão **4.03.00**: novos schemas XSD (colocar em `src/lib/tiss/schemas/4.03/`), terminologias TUSS atualizadas (materiais/OPME, medicamentos, glosas e negativas), componente organizacional revisado.
3. Migração assistida: tela em `/app/configuracoes/convenios` para atualizar a versão por operadora, com aviso de prazo regulatório.
4. Validação estrutural contra o XSD correto antes de fechar lote; testes de builder e validator para 3.05 e 4.03.
5. Documentar em `docs/tiss.md` o mapa de campos por versão.

## ETAPA 16C — NFS-e PADRÃO NACIONAL + RECEITA SAÚDE (OBRIGATÓRIO DESDE JAN/2026)

1. Implementar no adapter `nfse` um provider **`nfse-nacional`** (layout do Portal Nacional da NFS-e / LC 214/2025): emissão via API do ambiente nacional com certificado digital da org, DPS → NFS-e, consulta, cancelamento e substituição. Manter mock como default em dev.
2. Models: `FiscalSettings` por org (regime tributário, CNAE, código de serviço nacional, alíquotas, certificado A1 criptografado com `phi.ts`), `FiscalDocument` (tipo NFSE/RECIBO, status, número, chave, XML/JSON de retorno, vínculo com `Payment`/`Sale`).
3. Fluxo: emissão manual e automática (configurável) ao quitar recebível; fila com retry; PDF/DANFSe para o paciente no portal.
4. **Receita Saúde:** para profissionais PF, gerar recibo compatível (paciente CPF) com registro exportável — relatório mensal para o carnê-leão.
5. Preparar campos de **reforma tributária** (CBS/IBS) no plano de contas e nos documentos fiscais, atrás de feature flag.

## ETAPA 16D — ASSINATURA DIGITAL ICP-BRASIL + TRILHA SBIS/CFM NGS2

Meta: prontuário 100% digital com validade jurídica, no nível exigido para certificação SBIS/CFM NGS2.

1. Adapter `digital-signature`: providers **A1 no servidor** (certificado da org/profissional, PKCS#7/CAdES) e **DSaS via API** (ex.: BirdID/Certisign — interface genérica), além do mock atual. Carimbo de tempo (ACT/ITI) na interface.
2. Assinar no fechamento do `Encounter`, em `Prescription`, `MedicalCertificate` e laudos: PDF assinado (PAdES) armazenado + hash na trilha de auditoria.
3. Verificador público: rota `/verificar/[codigo]` que valida hash e exibe metadados do documento sem PHI.
4. Checklist NGS2 em `docs/sbis-ngs2.md`: mapear requisito a requisito (autenticação, trilha de auditoria, assinatura, backup, disponibilidade) o que já é atendido e o que falta — para futura certificação formal.

## ETAPA 16E — PRESCRIÇÃO DIGITAL INTEGRADA (paridade Memed/Nexodata)

1. Provider real no adapter `prescription-provider` (interface já existe): iniciar com **Memed** (embed + webhook de retorno) mantendo mock.
2. Receita assinada digitalmente (usa 16D) com QR Code e validação em farmácia (padrão prescricaoeletronica.cfm.org.br); receituário de controle especial (portaria 344) com numeração e livro.
3. Interações medicamentosas e alergias: checagem local contra `DrugCatalog` + alergias do paciente no momento da prescrição, com alerta bloqueante configurável.
4. Envio da receita ao paciente por WhatsApp/e-mail (adapter messaging) e disponível no portal.

## ETAPA 16F — COMUNICAÇÃO REAL: WHATSAPP BUSINESS API + PAGAMENTOS

1. Provider **WhatsApp Cloud API (Meta)** no adapter `messaging`: templates aprovados (confirmação, lembrete, NPS, cobrança), webhook de status e resposta (confirmar/cancelar por botão), janela de 24h respeitada, opt-out sincronizado.
2. Provider **PIX real** no adapter `payments` (interface Efí/Mercado Pago/Stripe — escolher uma como referência, manter genérico): cobrança com QR dinâmico no checkout, no link de cobrança da régua de inadimplência e no agendamento online (sinal/pré-pagamento configurável); conciliação automática via webhook.
3. Provider de e-mail transacional real (Resend/SES) no adapter existente.
4. Central de conversas: tela `/app/relacionamento/conversas` unificando mensagens enviadas/recebidas por paciente (WhatsApp inbound via webhook), com atribuição à recepção e integração com a IA secretária existente (módulo `ai`) para resposta assistida.

## ETAPA 16G — IA CLÍNICA: SCRIBE E COPILOTO (paridade TOTVS/Amplimed 2026)

Usar o módulo `ai` existente (AiSettings, consentimento, logs, limites mensais) — nunca enviar PHI sem `AiDataProcessingConsent`.

1. **Ambient scribe:** gravação de áudio da consulta (consentimento explícito do paciente registrado), transcrição via adapter `llm`/STT (mock: arquivo → texto simulado), geração de SOAP estruturado que o profissional revisa e aceita campo a campo antes de entrar no `Encounter`. Áudio descartado após transcrição (configurável, default = descartar).
2. **Copiloto do prontuário:** sugestão de CID-10 a partir da anamnese, resumo do histórico do paciente ao abrir atendimento, rascunho de encaminhamento/laudo.
3. **IA de gestão:** narrativa mensal do dashboard (já há métricas diárias), detecção de anomalias (queda de ocupação, aumento de no-show, glosa acima da média) gerando `UserNotification`.
4. Tudo com badge "gerado por IA — revise antes de assinar", log em `AiInteractionLog` e custo em `AiUsageMonthly`.

## ETAPA 16H — FATURAMENTO SUS (BPA/SIGTAP) — diferencial vs. Feegow/iClinic, paridade MV/Tasy no ambulatorial

Feature flag `sus` (plano ENTERPRISE). Escopo ambulatorial (sem internação/AIH).

1. Models: `SigtapProcedure` (seed importável da tabela SIGTAP com competência), `SusEstablishment` (CNES da org), `BpaSheet` (folha BPA-C consolidado e BPA-I individualizado por competência).
2. Atendimento marcado como SUS gera registro BPA a partir do encounter (procedimento SIGTAP, CID compatível, CBO do profissional); validações de compatibilidade procedimento×CID×CBO×idade/sexo.
3. Exportação do arquivo de remessa BPA (layout DATASUS) por competência + relatório de produção.
4. Documentar em `docs/sus.md`.

## ETAPA 16I — POLIMENTO COMPETITIVO

1. **Confirmação inteligente de agenda:** score de risco de no-show (histórico do paciente, antecedência, dia/horário) priorizando a régua de confirmação; overbooking sugerido configurável.
2. **Sala de espera virtual na teleconsulta** + teste de câmera/microfone; gravação de consentimento CFM 2.314/2022 já existente — anexar ao encounter.
3. **Marketplace de integrações:** página `/app/configuracoes/integracoes` reorganizada em catálogo (status: ativo/mock/disponível), com documentação por integração.
4. **Comparativos de BI:** benchmark interno anônimo entre unidades (ocupação, ticket, no-show, glosa) e metas por unidade.
5. **Acessibilidade e performance:** auditoria Lighthouse ≥ 90 nas telas de alto volume (agenda, recepção, atendimento); atalhos de teclado documentados em modal `?`.
6. Atualizar `README.md`, `CHANGELOG.md`, `DECISOES.md` e docs por módulo ao fim de cada etapa.

---

## ORDEM E CRITÉRIO DE PRONTO

Ordem: **16A → 16B → 16C → 16D → 16E → 16F → 16G → 16H → 16I** (16A/16B/16C são bloqueantes por serem regulatórios/segurança).

Cada etapa só está pronta quando: migrations aplicadas, typecheck e build verdes, testes unitários + isolamento de tenant passando, checklist manual entregue, docs atualizadas. Se uma etapa for grande demais, divida (16B-1, 16B-2...) e apresente o plano antes de codar.

Comece agora pela **ETAPA 16A**, apresentando primeiro o plano de arquivos que vai alterar.
