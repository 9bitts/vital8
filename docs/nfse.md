# NFS-e Padrão Nacional + Receita Saúde

Documentação da Fase 16C — emissão fiscal no Vital8.

## Visão geral

| Documento | Quando | Adapter |
|-----------|--------|---------|
| **NFS-e** (PJ) | Clínicas/consultórios com CNPJ | `nfse-nacional` ou `mock` |
| **Recibo Receita Saúde** (PF) | Profissionais autônomos / CPF | Gerador interno |

Prazo regulatório: **NFS-e Padrão Nacional obrigatório desde jan/2026** (LC 214/2025).

## Models

### `FiscalSettings` (por organização)

- Regime tributário, CNAE, código de serviço nacional
- Alíquota ISS (basis points)
- Provedor: `MOCK` | `NFSE_NACIONAL`
- Certificado A1 (PFX base64 + senha) criptografado com `phi.ts`
- `autoEmitOnPayment` — emissão ao quitar recebível
- `emitProfile`: `AUTO` | `NFSE_ONLY` | `RECEITA_SAUDE_ONLY`
- Feature flag `cbsIbsEnabled` + alíquotas CBS/IBS (reforma tributária)

### `FiscalDocument`

- Tipos: `NFSE` | `RECIBO_RECEITA_SAUDE`
- Status: `PENDING` → `PROCESSING` → `ISSUED` | `FAILED`
- Vínculo com `Payment`, `Sale`, `Patient`, `Professional`
- `pdfStorageKey` — DANFSe/recibo no storage
- Fila com `retryCount` e `nextRetryAt` (1, 5, 15, 60, 240 min)

## Adapters (`src/lib/integrations/nfse/`)

```
index.ts           # getNfseAdapter(provider)
mock.adapter.ts    # default em dev
nacional.adapter.ts # DPS → NFS-e Portal Nacional
dps-builder.ts     # payload LC 214/2025
types.ts           # issue, consult, cancel, substitute
```

Em produção com `NFSE_NACIONAL`: exige certificado A1 e `NFSE_NACIONAL_API_URL`.

## Fluxos

### Emissão automática

1. Pagamento registrado (`registerPaymentAction` ou checkout)
2. `enqueueFiscalEmission()` se `autoEmitOnPayment=true`
3. Cron `/api/jobs/process` → `processFiscalQueue()`
4. `emitFiscalDocument()` → adapter ou Receita Saúde

### Emissão manual

- `/app/financeiro/fiscal` → informar ID do pagamento → **Emitir manual**
- Checkout com checkbox "Emitir NFS-e" força emissão imediata

### Portal do paciente

- Documentos emitidos listados em `/portal/[orgSlug]`
- Download PDF: `GET /api/portal/fiscal/[docId]`

### Carnê-leão

- `/app/financeiro/fiscal` → exportar CSV mensal de recibos Receita Saúde
- Colunas: data, CPF paciente, nome, serviço, valor, profissional

## Configuração

`/app/configuracoes/fiscal`:

1. Regime, CNAE, código serviço nacional
2. Provedor NFS-e (mock em dev)
3. Certificado A1 (produção)
4. Perfil de emissão e emissão automática
5. CBS/IBS (feature flag)

## Plano de contas — reforma tributária

`FinancialCategory.cbsApplicable` e `ibsApplicable` preparados para classificação futura.

## Testes

```powershell
npm test -- src/lib/integrations/nfse/nfse.test.ts
npm test -- src/modules/finance/fiscal.test.ts
```

## Referências

- Portal Nacional NFS-e: https://www.gov.br/nfse
- LC 214/2025 (reforma tributária)
- `DECISOES.md` — decisão Fase 16C
