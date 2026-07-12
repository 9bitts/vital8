# PROMPT FASE 2 — PACIENTES (copiar e colar no Cursor após o prompt mestre)

---

OK, aprovado. Execute agora a **FASE 2 — PACIENTES** completa, conforme o prompt mestre. Reforço do escopo e critérios de aceite:

## Escopo obrigatório

**Models (Prisma, migration incremental — não resetar nada existente):**
`Patient` (nome, nome social, CPF criptografado + `cpfHash` único por organização, RG, data de nascimento, sexo, gênero, estado civil, profissão, telefones, e-mail, endereço completo com CEP, foto, observações, origem/como conheceu, tags, ativo/inativo), `PatientGuardian`, `PatientInsurancePlan` (convênio, carteirinha, validade, plano), `PatientConsent` (termo, versão, data, canal), `PatientDocument` (upload via adapter de storage: filesystem em dev, interface pronta para S3), `Allergy`, `ChronicCondition`, `PatientMedication`.

**Regras técnicas:**

1. CPF, RG, telefones, e-mail, endereço e observações clínicas criptografados com `src/lib/crypto/phi.ts`. Busca por CPF via `cpfHash` (HMAC-SHA256 com chave dedicada). Nome em claro para busca — registrar essa decisão em DECISOES.md.
2. Tudo via `tenantClient`; teste de isolamento multi-tenant para Patient no padrão de `tenant-isolation.test.ts`.
3. Toda ação (criar, editar, inativar, mesclar, exportar, visualizar ficha) auditada.
4. Soft delete; exclusão LGPD = anonimização (substituir PHI por marcadores, manter esqueleto para integridade referencial) — ação restrita a OWNER/ADMIN com confirmação dupla.
5. Server Actions + Zod; validação de CPF real (dígitos verificadores); máscara e busca de endereço por CEP via ViaCEP com fallback manual.

**Telas (em `/app/pacientes`, seguindo o shell e o padrão visual existentes):**

1. Listagem com busca instantânea (nome, CPF, telefone, carteirinha), filtros (tag, convênio, ativo/inativo), paginação e ordenação.
2. Cadastro/edição em abas: Dados pessoais · Contato e endereço · Convênios · Saúde (alergias, condições, medicamentos) · Documentos · LGPD (consentimentos, exportar, anonimizar).
3. Cadastro rápido (modal: nome + telefone) para a recepção.
4. Ficha do paciente com cabeçalho fixo (foto, idade, convênio, alertas de alergia em destaque) e linha do tempo de eventos (por ora: cadastro, edições, consentimentos, documentos — preparada para receber consultas e pagamentos nas fases seguintes).
5. Detecção de duplicados no cadastro (cpfHash ou nome+nascimento) com tela de mesclagem (escolher campo a campo, auditado).
6. Aniversariantes do dia/semana (card no dashboard).
7. Importação CSV com mapeamento de colunas, prévia, relatório de erros linha a linha; exportação LGPD do titular em JSON + PDF.

**Permissões:** RECEPCAO e PROFISSIONAL criam/editam; só OWNER/ADMIN mesclam, anonimizam e exportam em massa; aba Saúde visível para PROFISSIONAL e ADMIN/OWNER (não para FINANCEIRO).

**Seed:** ~15 pacientes fictícios variados (com convênio, particular, menor com responsável, alergias) nas duas organizações do seed existente.

## Entrega

Ao final: `npx tsc --noEmit` limpo, `npm run build` verde, `npm test` passando (novos testes: validação de CPF, criptografia dos campos, isolamento, mesclagem), migration aplicável, README.md com checklist de verificação manual da Fase 2 e DECISOES.md atualizado. Se precisar dividir em etapas (2A modelos+listagem, 2B ficha+LGPD+importação), apresente o plano e execute na sequência sem parar entre elas.

Comece.
