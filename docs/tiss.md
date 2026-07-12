# TISS — Padrão ANS no Vital8

O Vital8 suporta múltiplas versões do padrão TISS com estratégia por versão (builder, validator, XSD).

## Versões suportadas

| Versão | Status | Prazo ANS |
|--------|--------|-----------|
| **3.05.00** | Legado | Inválido após 01/07/2026 |
| **4.03.00** | Obrigatória | Vigente desde 01/07/2026 |

A versão é configurada por operadora em `HealthInsurer.tissVersion` em `/app/configuracoes/convenios`.

Versões 4.01/4.02 são normalizadas para **4.03.00** no builder.

## Arquitetura

```
src/lib/tiss/
  strategy.ts              # getTissStrategy(version)
  version.ts               # SUPPORTED_TISS_VERSIONS, normalizeTissVersion
  xml-builder.ts           # Facade → strategy.buildBatchXml
  validator.ts             # Facade → strategy.validate*
  versions/
    3.05/builder.ts        # XML legado
    3.05/validator.ts
    4.03/builder.ts        # XML com componenteOrganizacional
    4.03/validator.ts
  schemas/
    3.05/tissV30500.xsd
    4.03/tissV40300.xsd
```

## Mapa de campos por versão

### Cabeçalho da mensagem

| Campo | 3.05.00 | 4.03.00 |
|-------|---------|---------|
| `identificacaoTransacao` | Sim | Sim |
| `origem.identificacaoPrestador` | Sim | Sim (CNES obrigatório) |
| `destino.registroANS` | Sim | Sim |
| `componenteOrganizacional` | Não | **Sim** — `codigoCNES` + `nomeUnidade` |
| `identificacaoSoftware` | Não | **Sim** — Vital8 1.0.0 |
| `competencia` | Sim | Sim |

### Guia de consulta

| Campo | 3.05.00 | 4.03.00 |
|-------|---------|---------|
| `dadosContratadoExecutante` | Sim | Renomeado → `dadosExecutante` |
| `profissionalExecutante` | Sim | Sim |
| `procedimentosExecutados` | Sim | Sim + `codigoTabela` (22 = TUSS) |
| `sequencialItem` | Não | Sim |
| `viaAcesso` / `tecnicaUtilizada` | Não | Sim (default 1) |

### Validação de guia (pré-lote)

| Regra | 3.05.00 | 4.03.00 |
|-------|---------|---------|
| Carteirinha, TUSS, profissional | Sim | Sim |
| Tipo consulta (GUIA_CONSULTA) | Sim | Sim |
| Autorização prévia (se exigida) | Sim | Sim |
| **CNES do prestador** | Opcional | **Obrigatório** |

### Epílogo

Ambas as versões usam MD5 do conteúdo pré-`<epilogo>` em `<hash>`.

## Fluxo operacional

1. Atendimento convênio finalizado → guia gerada (`guide.service.ts`)
2. Validação com `validateGuideFields(payload, insurer.tissVersion)`
3. Lote criado → `closeBatch()` chama `buildTissBatchXml` + `validateTissXmlStructure(xml, version)`
4. XML persistido em storage; `Receivable` origin `TISS_BATCH`

## Migração assistida

Em `/app/configuracoes/convenios`:

- Banner com prazo regulatório (01/07/2026)
- Lista de operadoras em versão legada
- Select `3.05.00` / `4.03.00` por operadora
- Botão "Atualizar versão" em cada operadora existente

## TUSS

- Tabela 22 (procedimentos) usada em 4.03 via `<codigoTabela>22</codigoTabela>`
- Import CSV em convênios: `codigo;termo`
- Mapeamento Service ↔ TUSS obrigatório para geração de guia

## Testes

```powershell
npm test -- src/lib/tiss/validator.test.ts
npm test -- src/modules/tiss/tiss-sequence.test.ts
```

## Referências

- ANS — Padrão TISS: https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss
- `DECISOES.md` — decisão de multi-versão (Fase 6 / atualização Fase 16B)

## Port Doctor8 4.01 → Vital8 4.03 (Fase 17F)

O Doctor8 exportava TISS **4.01** com XML simplificado (`tiss-export.ts` + `tiss-validate.ts`). O Vital8 mantém a **4.03** da Fase 16B e incorpora as regras de validação do Doctor8.

### Diff estrutural 4.01 (Doctor8) → 4.03 (Vital8)

| Elemento | Doctor8 4.01 | Vital8 4.03 |
|----------|--------------|-------------|
| Namespace + `versao` | `<Padrao>` no cabeçalho | `versao="4.03.00"` no root |
| `componenteOrganizacional` | Ausente | **Obrigatório** (CNES + nome unidade) |
| `identificacaoSoftware` | Ausente | Vital8 1.0.0 |
| Guia odonto | `guiaTratamentoOdontologico` | `GUIA_SP_SADT` (procedimentos odonto) |
| Procedimentos | `codigoProcedimento` simples | `codigoTabela` 22 + `sequencialItem` + `viaAcesso` |
| Epílogo hash MD5 | Não | **Sim** |
| Validação lote | `validateTissBatch` | `batch-validation.ts` (port) |
| CSV contábil | `buildAccountingCsv` | `accounting-csv.ts` (port) |

### Regras portadas do Doctor8

- Carteirinha **ou** CPF do beneficiário
- Número do conselho profissional obrigatório
- CNES obrigatório em 4.03
- Lote com ao menos uma guia; valores > 0
- Validação antes de `closeBatch()` — bloqueia XML inválido

### Normalização de versão

`4.01.00` e `4.02.00` são normalizados para estratégia **4.03.00** (`normalizeTissVersion`).
