# Prescrição digital — Fase 16E

Integração de prescrição eletrônica com validação CFM, controle especial (Portaria 344/98), checagem de segurança e envio ao paciente.

## Providers

| Provider | Uso | Configuração |
|----------|-----|--------------|
| `LOCAL` | Busca no `DrugCatalog` (default) | Nenhuma |
| `MEMED` | Embed + webhook | `memedPartnerId`, `memedApiKey` em `/app/configuracoes/prontuario` |

Variáveis de ambiente opcionais:

- `MEMED_API_URL` — API Memed (sem valor = fallback local)
- `MEMED_EMBED_URL` — URL do embed
- `MEMED_WEBHOOK_SECRET` — validação do webhook `POST /api/webhooks/memed`
- `CFM_PRESCRIPTION_VALIDATION_URL` — base da validação farmácia (default: prescricaoeletronica.cfm.org.br)

## Fluxo de prescrição

1. Profissional busca medicamentos (provider configurado).
2. Checagem de **alergias** do paciente e **interações** (`DrugInteraction` seed).
3. Alertas bloqueantes conforme `PrescriptionSettings` (`blockOnAllergyConflict`, `blockOnDrugInteraction`).
4. Receita assinada via Fase 16D (`SignedClinicalDocument` + PAdES).
5. Código CFM (`validationCode`) + URL no PDF.
6. Controle especial: numeração sequencial por profissional (`PrescriptionControlSequence`).
7. Liberação automática no portal (`ReleasedDocument`).
8. Envio opcional WhatsApp/e-mail (`autoSendToPatient` ou botão manual).

## Portal do paciente

Receitas liberadas aparecem em `/portal/[orgSlug]` com download em:

`GET /api/portal/prescription/[prescriptionId]`

Requer sessão OTP do paciente e documento liberado.

## Webhook Memed

`POST /api/webhooks/memed` — atualiza `signedAt` quando prescrição externa é concluída. Vincula por `memedExternalId`.

## Testes

```bash
npx vitest run src/lib/integrations/prescription-provider/memed.adapter.test.ts
npx vitest run src/modules/emr/services/prescription-safety.test.ts
```
