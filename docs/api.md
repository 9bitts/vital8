# Vital8 Public API v1 — Guia de integração

API REST versionada em `/api/v1/*` para parceiros autorizados (ex.: Doctor8). Contratos genéricos — nada hard-coded por consumidor.

## Autenticação

```http
Authorization: Bearer {keyPrefix}.{secret}
```

- Prefixos: `vk_test_*` (SANDBOX) ou `vk_live_*` (PRODUCTION)
- Secret exibido **uma única vez** na criação da key
- Keys SANDBOX operam apenas na organização demo (`clinica-vida-plena`)

### Assinatura HMAC (opcional, recomendada em escritas)

```http
X-Vital8-Signature: t={unix_ts},v1={hmac_sha256_hex}
```

Payload assinado: `{timestamp}.{raw_body}` com o secret da key.

```typescript
import { createHmac } from "crypto";

function sign(secret: string, body: string) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return { header: `t=${t},v1=${v1}`, body };
}
```

## Escopos

| Escopo | Descrição |
|--------|-----------|
| `patients:read` / `patients:write` | Pacientes |
| `appointments:read` / `appointments:write` | Agendamentos |
| `schedule:read` | Disponibilidade, profissionais, serviços |
| `encounters:read` | Atendimentos (conteúdo clínico exige habilitação OWNER + LGPD) |
| `financial:read` / `financial:write` | Financeiro |
| `insurance:read` | Convênios |
| `stock:read` | Estoque |
| `webhooks:manage` | Webhooks (ENTERPRISE) |

## Idempotência

Todo `POST` que cria recurso exige:

```http
Idempotency-Key: {uuid}
```

Resposta armazenada por 24h; repetição retorna a mesma resposta sem duplicar.

## Rate limits

| Plano | Limite |
|-------|--------|
| BASICO | 60 req/min |
| PRO | 300 req/min |
| ENTERPRISE | 1000 req/min |

Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` (429).

## Paginação

```http
GET /api/v1/patients?cursor={cursor}&limit=20&updatedAfter=2026-01-01T00:00:00Z
```

Resposta: `{ data, meta: { cursor, hasMore, limit } }`.

## Webhooks

Assinatura HMAC-SHA256:

```http
X-Vital8-Signature: t={ts},v1={hmac}
X-Vital8-Event: appointment.created
```

Verificação (Node.js):

```typescript
function verifyWebhook(secret: string, rawBody: string, header: string) {
  const m = header.match(/t=(\d+),v1=([a-f0-9]+)/i);
  if (!m) return false;
  const expected = createHmac("sha256", secret).update(`${m[1]}.${rawBody}`).digest("hex");
  return expected === m[2];
}
```

Payload mínimo (sem PHI): `{ event, id, occurredAt }` — busque detalhes via API conforme escopo.

## Fluxo Doctor8 (ponta a ponta)

### 1. Validar credenciais

```bash
curl -s -H "Authorization: Bearer vk_test_xxx.secret" \
  http://localhost:3000/api/v1/ping
```

### 2. Sincronizar pacientes

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/patients?updatedAfter=2026-01-01T00:00:00Z&limit=50"
```

### 3. Criar paciente (idempotente)

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"fullName":"Maria Silva","cpf":"52998224725"}' \
  http://localhost:3000/api/v1/patients
```

### 4. Consultar disponibilidade

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/availability?professionalId=PROF_ID&serviceId=SVC_ID&from=2026-07-15T00:00:00Z&to=2026-07-20T23:59:59Z"
```

### 5. Criar agendamento

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: appt-$(uuidgen)" \
  -d '{"patientId":"PAT_ID","professionalId":"PROF_ID","serviceId":"SVC_ID","startsAt":"2026-07-16T10:00:00Z"}' \
  http://localhost:3000/api/v1/appointments
```

### 6. Webhook de confirmação

Configure endpoint no painel **Configurações → API e Integrações**. Evento `appointment.status_changed` — valide assinatura e busque `GET /api/v1/appointments/{id}`.

### 7. Receita após `encounter.signed`

Webhook `encounter.signed` com `id` do atendimento → `GET /api/v1/encounters/{id}` (escopo `encounters:read` + habilitação clínica) → metadados de prescrições com URL assinada quando disponível.

## Erros

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": []
  }
}
```

Códigos: `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INSUFFICIENT_SCOPE`, `UNAUTHORIZED`, `FORBIDDEN`, `FEATURE_DISABLED`.

## OpenAPI

Spec: [`/api/v1/openapi.json`](/api/v1/openapi.json)  
Portal: [`/app/desenvolvedores`](/app/desenvolvedores)

## Feature flags

- **API pública:** PRO e ENTERPRISE
- **Webhooks:** ENTERPRISE
