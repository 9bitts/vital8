# Guia RNDS — Credenciamento e Integração Vital8

Este guia descreve o processo de credenciamento real na **RNDS** (Rede Nacional de Dados em Saúde) e o que o Vital8 automatiza versus o que depende do gestor da clínica.

## O que é a RNDS

A RNDS é o barramento nacional de saúde do Ministério da Saúde (DATASUS). Estabelecimentos credenciados enviam registros em **HL7 FHIR R4** — incluindo Registro de Atendimento Clínico (RAC) e Resultado de Exame Laboratorial.

## Pré-requisitos (burocracia do gestor)

1. **Certificado digital ICP-Brasil** do estabelecimento (e-CNPJ ou e-CPF do responsável legal, conforme tipo).
2. **CNES** ativo da unidade (campo já disponível em Configurações → Unidades).
3. Acesso ao **Portal de Serviços do DATASUS**: https://servicos.saude.gov.br
4. Solicitar credenciamento ao serviço **EHR Services** (barramento FHIR da RNDS).

### Fluxo no Portal DATASUS

| Etapa | Responsável | O que fazer |
|-------|-------------|-------------|
| 1. Cadastro | Gestor | Login Gov.br + certificado no Portal de Serviços |
| 2. Solicitação | Gestor | Pedir acesso ao EHR Services / RNDS para o CNES |
| 3. Homologação | Gestor + Vital8 | Enviar registros de teste; DATASUS valida perfis FHIR |
| 4. Produção | DATASUS | Liberação após homologação aprovada |

## O que o Vital8 automatiza

| Funcionalidade | Tela / API |
|----------------|------------|
| Mapeamento Vital8 ↔ FHIR R4 (perfis BR) | `src/modules/fhir/` |
| Leitura FHIR para parceiros | `GET /api/v1/fhir/{resource}` (escopo `fhir:read`) |
| Upload de certificado A1 (criptografado) | Configurações → Interoperabilidade |
| Referência A3 (token/slot) | Mesma tela — tipo A3 |
| Autenticação `POST /token` + cache 15 min | Adapter `src/lib/integrations/rnds/` |
| Envio de Bundle RAC (atendimento assinado) | Job automático + fila de submissões |
| Envio de Resultado de Exame | Job automático (prazo configurável) |
| Retry com backoff + DLQ | Monitor de submissões |
| Tradução de `OperationOutcome` | Detalhe de rejeição na UI |
| Integração laboratório (mock dev) | Simulador FHIR ponta a ponta |

## O que NÃO é automatizado (gestor)

- Negociação com DATASUS / abertura de chamado no Portal
- Emissão ou renovação do certificado ICP-Brasil
- Homologação formal no ambiente do Ministério
- Contrato com laboratórios externos (apenas o conector técnico é fornecido)

## Configuração no Vital8 (homologação mock)

1. Login como OWNER/ADMIN em org **ENTERPRISE** (`ana@vidaplena.local`).
2. Acesse **Configurações → Interoperabilidade**.
3. Salve credencial mock (certificado base64 fictício + identificador solicitante).
4. Clique **Testar conexão** — em dev, o mock simula `POST /token` com TTL de 15 minutos.
5. Ative regras de envio automático (RAC / resultados).
6. O job `/api/jobs/process` processa fila, retry e DLQ.

## Ambientes

| Ambiente | Token URL (referência) |
|----------|------------------------|
| Homologação | `https://ehr-services.hmg.saude.gov.br/api/token` |
| Produção | `https://ehr-services.saude.gov.br/api/token` |

Em produção real, substitua o adapter mock por implementação com `fetch` + mTLS usando o certificado A1 descriptografado em runtime (interface já definida em `RndsAdapter`).

## Registros implementados

- **RAC** — a partir de `Encounter` com status `ASSINADO` (Fase 4)
- **Resultado de Exame** — a partir de `ExamResult` com valores estruturados

## Suporte

Documentação canônica RNDS: https://rnds-guia.saude.gov.br/

Decisões de perfis e mapeamentos: `DECISOES.md` (seção Fase 13).
