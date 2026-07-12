# Vital8 — Fase 2 (Pacientes)

ERP SaaS multi-tenant vertical em saúde. Fases entregues: **Fase 1 (Fundação)** + **Fase 2 (Pacientes / CRM clínico)**.

## Stack

- Next.js 14 (App Router)
- TypeScript strict
- Prisma 7 + `@prisma/adapter-pg` + PostgreSQL
- Auth.js v5 (JWT)
- Zod
- Tailwind CSS + shadcn/ui
- Vitest

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

Pacientes seed (Clínica Vida Plena): Roberto Almeida, Fernanda Costa, Paciente Rápido (incompleto).

## Testes

```powershell
# Criptografia PHI
npm test -- src/lib/crypto/phi.test.ts

# Hash/busca (CPF, nome)
npm test -- src/lib/crypto/search-hash.test.ts

# Isolamento multi-tenant (core)
npm test -- src/lib/db/tenant-isolation.test.ts

# Isolamento multi-tenant (pacientes)
npm test -- src/modules/patients/patient-tenant-isolation.test.ts

# Todos os testes
npm test

# Typecheck
npx tsc --noEmit
```

## Estrutura principal

```
src/
  app/                      # Rotas Next.js
  modules/core/             # Organização, membros, convites, auditoria
  modules/patients/         # CRM clínico (Fase 2)
  lib/db/                   # admin-client, tenant-client
  lib/auth/                 # Auth.js, guards
  lib/crypto/               # PHI encryption + search hash
  lib/features/             # Feature flags por plano
  lib/integrations/storage/ # Upload local (dev) / S3 futuro
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

---

## CHECKLIST DE VERIFICAÇÃO — Fase 2 (Pacientes)

Execute em PowerShell na raiz do projeto:

```powershell
# 1. Migrations aplicadas
npx prisma migrate status

# 2. TypeScript sem erros
npx tsc --noEmit

# 3. Testes
npm test

# 4. Build de produção
npm run build

# 5. Fluxo manual (dev server: npm run dev)
# Login: ana@vidaplena.local / Vital8@dev
# - /app/pacientes → listar, buscar por nome/CPF/telefone
# - Cadastro rápido → nome + telefone → redireciona para editar
# - Novo paciente → cadastro completo
# - Abrir paciente → ficha, alertas de saúde, linha do tempo
# - Editar → abas contato, convênio, saúde, documentos, LGPD
# - /app/pacientes/aniversariantes → Fernanda (12/07) se data coincidir
# - /app/pacientes/duplicados → mesclagem (criar duplicata de teste)
# - /app/pacientes/importar → CSV com colunas nome,cpf,telefone
# - Exportar LGPD (OWNER) → download JSON
# - Configurações → Auditoria → eventos patient.*
# - Trocar org (bruno@multi.local) → pacientes isolados por tenant
```

## Pendências (fases futuras)

- Fase 3: Agenda e Recepção
- Fase 4: Prontuário Eletrônico
- Fase 5: Financeiro
- Envio de convite por e-mail transacional
- Google OAuth
- Storage S3 em produção
