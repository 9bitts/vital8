# PROMPT FASE 13 — INTEROPERABILIDADE FHIR, RNDS E LABORATÓRIOS (copiar e colar no Cursor após concluir a Fase 12)

---

Fase 12 validada. Execute agora a **FASE 13 — INTEROPERABILIDADE**: o Vital8 passa a falar **HL7 FHIR R4** (padrão obrigatório da RNDS — Rede Nacional de Dados em Saúde, do Ministério da Saúde/DATASUS) e a trocar dados com laboratórios. Todas as regras invioláveis do prompt mestre continuam valendo. Como o credenciamento real na RNDS exige certificado digital ICP-Brasil do estabelecimento e homologação no Portal de Serviços do DATASUS, TODA a comunicação externa fica atrás de adapters com mock fiel dos ambientes de homologação/produção — o sistema sai pronto para plugar as credenciais reais.

## Escopo obrigatório

### 13.1 Camada FHIR

1. Módulo `src/modules/fhir/`: mapeadores bidirecionais entre os models do Vital8 e recursos **FHIR R4**: `Patient` (com CPF e CNS — adicionar campo CNS criptografado ao Patient da Fase 2), `Practitioner` + `PractitionerRole` (profissional + conselho), `Organization`/`Location` (clínica/unidades com CNES — adicionar CNES ao Branch), `Appointment`, `Encounter`, `Condition` (CID-10), `AllergyIntolerance`, `MedicationRequest` (prescrição), `Observation` + `DiagnosticReport` (resultados de exames), `ServiceRequest` (solicitação de exame), `DocumentReference` (documentos), `Immunization` (estrutura pronta, sem UI nesta fase), `Bundle` (composição para envio).
2. Validação estrutural dos recursos gerados (tipos, cardinalidades, terminologias — CID-10, TUSS onde aplicável) com testes de round-trip: model → FHIR → model sem perda.
3. **Endpoint FHIR de leitura na API pública (Fase 11):** `/api/v1/fhir/{resource}` (Patient, Appointment, DiagnosticReport...) com os mesmos escopos/segurança da Fase 11 — o Doctor8 e parceiros podem consumir formato FHIR nativo. Suportar `_lastUpdated` para sincronização.
4. Perfis brasileiros: seguir os perfis da RNDS onde publicados (identificadores CPF/CNS/CNES, extensões BR) — documentar em DECISOES.md as escolhas e as URLs canônicas usadas.

### 13.2 Conector RNDS

1. Adapter `rnds` em `src/lib/integrations/rnds/`: autenticação por certificado digital ICP-Brasil do estabelecimento via `POST /token` (access_token com vida de 15 minutos — cache e renovação automática), ambientes HOMOLOGACAO/PRODUCAO configuráveis por organização, envio de Bundles FHIR ao barramento (EHR Services). Mock em dev que simula respostas, protocolos e erros reais do barramento.
2. **Models:** `RndsCredential` (por organização/unidade: certificado A1 armazenado criptografado OU referência a A3, identificador do solicitante, ambiente, status do credenciamento), `RndsSubmission` (tipo de registro, recurso de origem — Encounter/ExamResult —, Bundle enviado, protocolo, status FILA/ENVIADO/ACEITO/REJEITADO/ERRO, resposta completa, tentativas).
3. Casos de envio implementados: **Registro de Atendimento Clínico (RAC)** a partir do Encounter assinado (Fase 4) e **Resultado de Exame (laboratório)** a partir do ExamResult — envio automático configurável (ex.: resultados em até 24h, exigência para laboratórios habilitados) via processador de jobs da Fase 8, com fila, retry e DLQ visível.
4. Tela `/app/configuracoes` → Interoperabilidade: credenciamento (upload do certificado, teste de conexão, status homologação/produção), regras de envio automático por tipo, monitor de submissões (filtros, reenvio, detalhe da rejeição com o OperationOutcome traduzido).
5. Guia `docs/rnds.md`: passo a passo do credenciamento real (Portal de Serviços DATASUS → solicitar acesso → homologação → produção), o que o Vital8 automatiza e o que é burocracia do gestor.

### 13.3 Integração com laboratórios

1. Adapter `lab-integration` genérico: enviar `ServiceRequest` (pedido de exame da Fase 4) e receber `DiagnosticReport`/`Observation` (resultado) — duas vias de recebimento: webhook de entrada na API da Fase 11 (`POST /api/v1/inbound/lab-results`, autenticado por API key com escopo próprio) e polling configurável.
2. Resultado recebido: conciliação automática com o ExamRequest do paciente (por identificador do pedido; fila de conciliação manual quando ambíguo), valores estruturados gravados, profissional solicitante notificado (centro de notificações), **valores fora da referência destacados**; liberação ao portal do paciente conforme regra da Fase 8.
3. Mock de laboratório completo em dev (simulador que responde pedidos com resultados fictícios em FHIR) para testar o fluxo ponta a ponta.

**Permissões:** configuração e credenciais: OWNER/ADMIN; monitor de submissões: ADMIN; conciliação de resultados: PROFISSIONAL/ADMIN. **Feature flag:** interoperabilidade em ENTERPRISE.

**Seed:** credencial RNDS de homologação fictícia na org demo, 3 submissões em status variados (aceito, rejeitado com OperationOutcome, em fila), 1 pedido de exame com resultado recebido e conciliado.

## Testes obrigatórios

Round-trip de todos os mapeadores FHIR; Bundle RAC válido gerado de um Encounter assinado do seed; renovação de token (expiração 15 min simulada); retry/DLQ de submissão; conciliação de resultado (match exato, ambíguo → fila manual); certificado armazenado criptografado; isolamento multi-tenant (submissão e credencial); endpoint FHIR da API respeita escopos.

## Entrega

`npx tsc --noEmit` limpo, `npm run build` verde, `npm test` passando, migrations aplicáveis, README.md com checklist manual da Fase 13 (configurar credencial mock, enviar RAC de um atendimento assinado, ver rejeição traduzida e reenviar, pedir exame → receber resultado do simulador → conciliar → notificação → liberar no portal, consumir `/api/v1/fhir/Patient` com key da Fase 11) e DECISOES.md atualizado (perfis BR adotados, estratégia de certificado, mapeamentos). Se dividir (13A camada FHIR+mapeadores, 13B conector RNDS, 13C laboratórios), apresente o plano e execute na sequência.

Comece.
