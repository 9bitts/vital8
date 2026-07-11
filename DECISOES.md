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
