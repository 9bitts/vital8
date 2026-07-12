# Decisões arquiteturais — Vital8

Registro de decisões tomadas na Fase 1 quando há trade-offs ou dependências de fases futuras.

## Multi-tenancy

**Decisão:** Banco compartilhado, schema compartilhado, isolamento por `organizationId` via Prisma Client Extension.

**Alternativa descartada:** Schema por tenant (complexidade operacional alta para MVP).

**Reversibilidade:** Migração futura para schema dedicado por tenant grande (Enterprise) permanece possível exportando por `organizationId`.

## Organization fora do tenant client

**Decisão:** `Organization` e `User` são acessados via `admin-client.ts` com verificação explícita de permissão na server action (`where: { id: session.organizationId }`).

**Motivo:** Organization não possui `organizationId` — é a entidade raiz do tenant.

## Convites sem e-mail transacional

**Decisão:** Fase 1 exibe o link do convite na UI após criação (copiar manualmente). Envio por e-mail fica para integração futura.

**Motivo:** Prompt proíbe serviços externos nesta fase.

## AuditLog via admin client na listagem

**Decisão:** `listAuditLogs` usa `adminPrisma` com filtro explícito `organizationId`, protegido por `requireAuth(["OWNER", "ADMIN"])`.

**Motivo:** Serviço compartilhado entre auth (sem tenant context) e área autenticada; filtro duplo (guard + query) garante isolamento.

## Prisma 7 com driver adapter PostgreSQL

**Decisão:** Usar `@prisma/adapter-pg` + `pg` (obrigatório no Prisma 7).

**Motivo:** Prisma 7 exige adapter explícito; `DATABASE_URL` deve ser `postgresql://` (não `prisma+postgres://`).

**Arquivo:** `src/lib/db/create-prisma.ts` centraliza instanciação.

## JWT sem refresh de membership em cada request

**Decisão:** Role e organizationId vêm do JWT; troca de org atualiza via `session.update()`.

**Reversibilidade:** Fase futura pode invalidar sessão ao desativar membro (webhook/job ou check no middleware).

## Soft delete

**Decisão:** `deletedAt: null` injetado automaticamente no tenant client apenas para models com soft delete (`Membership` nesta fase).

**Motivo:** `Invitation` e `AuditLog` não possuem soft delete no schema da Fase 1.

**Atualização Fase 2:** Todos os models de paciente possuem soft delete e estão registrados em `MODELS_WITH_SOFT_DELETE`.

## Campos PHI e busca (Fase 2)

**Decisão:** CPF, RG, telefones, e-mail, endereço e observações clínicas são criptografados com AES-256-GCM (`phi.ts`). Campos derivados em claro para busca:

- `searchName` — nome normalizado (sem acentos, minúsculas)
- `cpfHash` — HMAC-SHA256 do CPF normalizado com `CPF_HASH_KEY` dedicada, escopado por `organizationId` (formato `{orgId}:{cpf}`)
- `phoneSearch` — dígitos do telefone principal (busca parcial)
- `cardNumberSearch` — últimos 6 dígitos da carteirinha

**Trade-off:** Telefone e carteirinha parcialmente indexáveis em claro para performance de busca na recepção. CPF nunca fica em claro no banco; hash usa chave dedicada separada de `PHI_ENCRYPTION_KEY`.

## ViaCEP (Fase 2)

**Decisão:** Busca de endereço via `ViaCepAdapter` (API pública gratuita) com fallback manual nos campos.

**Motivo:** UX de cadastro; serviço externo não obrigatório — usuário pode preencher manualmente se offline.

## Permissões aba Saúde (Fase 2)

**Decisão:** Aba Saúde e mutações clínicas (alergias, condições, medicamentos) restritas a `OWNER`, `ADMIN`, `PROFISSIONAL_SAUDE`. `RECEPCAO` e `FINANCEIRO` não acessam.

## Anonimização LGPD (Fase 2)

**Decisão:** Confirmação dupla na UI (nome completo + digitar `ANONIMIZAR`); apenas `OWNER`/`ADMIN`.

**Reversibilidade:** Busca full-text cifrada (ex.: envelope encryption + blind index) pode substituir campos derivados se política de segurança exigir.

## Upload de documentos (Fase 2)

**Decisão:** Adapter `LocalStorageAdapter` grava em `uploads/{orgId}/{patientId}/`. Produção: trocar por S3/R2 via mesma interface em `src/lib/integrations/storage/`.

**Motivo:** Prompt proíbe serviços pagos obrigatórios; filesystem local funciona 100% em dev.

## Anonimização LGPD vs delete físico

**Decisão:** Direito de eliminação implementado como anonimização (`anonymizedAt` + mascaramento PHI + soft delete), preservando trilha de auditoria e integridade referencial para fases futuras (agenda, prontuário).

## Feature flags por plano

**Decisão:** `features.service.ts` mapeia `Plan` (TRIAL/STARTER/PRO/ENTERPRISE) para módulos habilitados. Fase 2 registra flags; enforcement completo nas fases avançadas (TISS, BI, telemedicina).

## Mesclagem de duplicados

**Decisão:** Registro secundário recebe soft delete + nota criptografada com referência ao primário; relacionamentos são reparentados. Sem delete físico.

**Motivo:** Auditoria e conformidade SBIS/CFM (imutabilidade de trilha).
