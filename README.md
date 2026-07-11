# Vital8 — Fase 1 (Fundação)

ERP SaaS multi-tenant vertical em saúde. Esta fase entrega: multi-tenancy, autenticação, RBAC, auditoria, criptografia PHI (utilitário) e shell da aplicação.

## Stack

- Next.js 14 (App Router)
- TypeScript strict
- Prisma + PostgreSQL
- Auth.js v5 (JWT)
- Zod
- Tailwind CSS + shadcn/ui

## Pré-requisitos (Windows / PowerShell)

- Node.js 20+
- PostgreSQL 15+ (local ou Railway)
- Git

## Setup

### 1. Clonar e instalar dependências

```powershell
cd C:\Users\diego\Documents\vital8
npm install
npm approve-scripts --allow-scripts-pending
```

### 2. Configurar variáveis de ambiente

```powershell
Copy-Item .env.example .env
```

Edite `.env` com sua `DATABASE_URL` PostgreSQL.

Gere chaves seguras (32 bytes em base64):

```powershell
# AUTH_SECRET
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# PHI_ENCRYPTION_KEY
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 3. Banco de dados

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 4. Executar

```powershell
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## Contas de desenvolvimento (após seed)

Senha para todas: `Vital8@dev`

| E-mail | Papel | Organização |
|--------|-------|-------------|
| ana@vidaplena.local | OWNER | Clínica Vida Plena |
| carlos@drteste.local | OWNER | Consultório Dr. Teste |
| bruno@multi.local | ADMIN + FINANCEIRO | Ambas (testar switcher) |
| carla@vidaplena.local | RECEPCAO | Clínica Vida Plena |

## Testes

```powershell
# Testes unitários de criptografia PHI
npm test -- src/lib/crypto/phi.test.ts

# Testes de isolamento multi-tenant (requer DATABASE_URL)
npm test -- src/lib/db/tenant-isolation.test.ts

# Todos os testes
npm test

# Typecheck
npx tsc --noEmit
```

## Estrutura principal

```
src/
  app/                 # Rotas Next.js
  modules/core/        # Organização, membros, convites, auditoria
  lib/db/              # admin-client, tenant-client
  lib/auth/            # Auth.js, guards
  lib/crypto/          # PHI encryption
prisma/
  schema.prisma
  seed.ts
```

## Multi-tenancy

- Isolamento row-level por `organizationId`
- `createTenantClient(orgId)` injeta filtros automaticamente
- `adminPrisma` apenas para rotinas de sistema (documentado em `admin-client.ts`)

## Deploy

- **App:** Vercel
- **PostgreSQL:** Railway

Configure as mesmas variáveis de ambiente nos dois serviços.

## Decisões arquiteturais

Ver [DECISOES.md](./DECISOES.md)

## CHECKLIST DE VERIFICAÇÃO

Execute em PowerShell na raiz do projeto:

```powershell
# 1. Migrations aplicadas
npx prisma migrate status

# 2. TypeScript sem erros
npx tsc --noEmit

# 3. Testes de criptografia PHI
npm test -- src/lib/crypto/phi.test.ts

# 4. Testes de isolamento multi-tenant
npm test -- src/lib/db/tenant-isolation.test.ts

# 5. Build de produção
npm run build

# 6. Fluxo manual (dev server rodando: npm run dev)
# - /cadastro → criar conta
# - /entrar → login com ana@vidaplena.local / Vital8@dev
# - /app/configuracoes → convidar membro, copiar link
# - /convite/[token] → aceitar convite (aba anônima)
# - Header → trocar organização com bruno@multi.local
# - Aba Auditoria → verificar eventos registrados
```

## Pendências (fases futuras)

- Envio de convite por e-mail transacional
- Google OAuth
- Campos PHI criptografados (Fase 2 — pacientes)
- Módulos Agenda, Pacientes, Prontuário, Financeiro, etc.
