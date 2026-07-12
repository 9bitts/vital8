# IA clínica — Fase 16G

Scribe ambiente, copiloto do prontuário e detecção de anomalias de gestão.

## Requisitos

- Plano **ENTERPRISE** com feature `ai`
- Consentimento LGPD por recurso em `/app/configuracoes/ia`
- **Nunca** enviar PHI sem `AiDataProcessingConsent` (exceto `skipConsent` em sugestões internas da recepção)

## Ambient Scribe

1. Profissional registra **consentimento do paciente** (`PatientConsent` termKey `ai-scribe-audio`)
2. Gravação via `MediaRecorder` no navegador
3. Transcrição: adapter LLM `transcribe()` (mock em dev)
4. SOAP estruturado — revisão **campo a campo** com botão "Aplicar no prontuário"
5. Áudio **não persistido** quando `discardAudioAfterTranscription=true` (padrão)
6. Trilha: `ScribeSession` + `AiInteractionLog`

## Copiloto clínico

No atendimento (`encounter-workspace`):

- Resumo automático do histórico ao abrir
- SOAP a partir de texto livre ou scribe
- CID-10 sugerido a partir da anamnese
- Rascunhos de atestado e encaminhamento
- Badge: **"Gerado por IA — revise antes de assinar"**

## IA de gestão

- Narrativa mensal: card no dashboard executivo (existente)
- **Anomalias:** `scanBiAnomalies()` no cron `/api/jobs/process`
  - Queda de ocupação
  - Aumento de no-show
  - Glosa acima da média
- Notificações `BI_ANOMALY` para OWNER/ADMIN

## Testes

```bash
npx vitest run src/modules/ai/services/bi-anomaly.test.ts
npx vitest run src/modules/ai/ai.test.ts
```
