# SBIS/CFM NGS2 — Checklist de conformidade Vital8

Mapa requisito a requisito para certificação formal futura (NGS2 — Nível de Garantia de Segurança 2).  
**Legenda:** ✅ Atendido | ⚠️ Parcial | ❌ Pendente

## 1. Autenticação e controle de acesso

| Requisito | Status | Evidência no Vital8 |
|-----------|--------|---------------------|
| Autenticação individual por usuário | ✅ | NextAuth, `User` + `Membership` |
| Papéis e permissões granulares | ✅ | `Role`, `PermissionProfile`, `can()` |
| Sessão com revogação | ✅ | `sessionVersion` (Fase 16A), `maxAge` 8h |
| MFA | ❌ | Não implementado — recomendado para NGS2 |
| Bloqueio após tentativas | ✅ | `login-rate-limit.ts` |
| Escalonamento de papel bloqueado | ✅ | `canGrantRole()` (Fase 16A) |

## 2. Trilha de auditoria

| Requisito | Status | Evidência no Vital8 |
|-----------|--------|---------------------|
| Log de ações sensíveis | ✅ | `AuditLog`, `createAuditLog` |
| Acesso a prontuário registrado | ✅ | `RecordAccessLog` |
| Assinatura clínica auditada | ✅ | `clinical.sign` + `SignedClinicalDocument` (Fase 16D) |
| Logs sem PHI em produção | ⚠️ | `safeLog` (16A); revisar adapters restantes |
| Retenção e exportação de logs | ⚠️ | UI auditoria em configurações; política de retenção manual |

## 3. Assinatura digital e integridade

| Requisito | Status | Evidência no Vital8 |
|-----------|--------|---------------------|
| Prontuário imutável após assinatura | ✅ | `Encounter.status=ASSINADO`, `EncounterImmutableError` |
| Hash de integridade do conteúdo | ✅ | `contentHash` SHA-256 canônico |
| Assinatura ICP-Brasil | ⚠️ | Adapters A1/DSaS (16D); mock default em dev |
| PAdES em PDF | ⚠️ | Bloco PAdES simplificado + storage; PAdES completo com lib crypto pendente |
| Carimbo de tempo ACT/ITI | ⚠️ | Interface + mock; `ACT_TSA_URL` para produção |
| Verificação pública sem PHI | ✅ | `/verificar/[codigo]` |
| Assinatura em receita/atestado/laudo | ✅ | `SignedClinicalDocument` por entidade |

## 4. Confidencialidade (PHI)

| Requisito | Status | Evidência no Vital8 |
|-----------|--------|---------------------|
| Criptografia PHI em repouso | ✅ | `encryptPHI` AES-256-GCM |
| Isolamento multi-tenant | ✅ | `createTenantClient`, testes isolamento |
| Exportação LGPD com redação | ✅ | `redactThirdPartyText` (16A) |
| CSP endurecido | ✅ | Nonce em `/app` (16A) |
| API sem PHI em webhooks | ✅ | Eventos mínimos documentados |

## 5. Disponibilidade e continuidade

| Requisito | Status | Evidência no Vital8 |
|-----------|--------|---------------------|
| Health check | ✅ | `/api/health` |
| Backup documentado | ⚠️ | Responsabilidade infra; não automatizado no app |
| RPO/RTO definidos | ❌ | Definir em operação |
| Monitoramento | ⚠️ | Métricas BI internas; APM externo pendente |

## 6. Interoperabilidade e regulatório

| Requisito | Status | Evidência no Vital8 |
|-----------|--------|---------------------|
| FHIR R4 / RNDS | ⚠️ | Adapter mock + fila (Fase 13) |
| TISS 4.03 | ✅ | Fase 16B |
| NFS-e Nacional | ✅ | Fase 16C |
| Prescrição digital CFM | ✅ | Fase 16E — código validação + PAdES + portal |

## 7. Gestão de certificados

| Requisito | Status | Evidência no Vital8 |
|-----------|--------|---------------------|
| Certificado A1 criptografado | ✅ | `SignatureSettings` + `phi.ts` |
| Certificado A3 (token) | ⚠️ | Apenas referência (`certificateReference` DECISOES) |
| Rotação de certificado | ⚠️ | Upload manual em configurações |
| Validade monitorada | ❌ | Alerta de expiração pendente |

## Próximos passos para certificação formal

1. Homologar adapter ICP_A1 com biblioteca PKCS#7/CAdES real (ex.: `node-forge` ou HSM)
2. Integrar TSA ACT/ITI em produção (`ACT_TSA_URL`)
3. Implementar MFA para papéis clínicos
4. PAdES completo com validação em `/verificar`
5. Política de backup/restore testada e documentada
6. Auditoria externa SBIS com este checklist como base

## Referências

- CFM — Resolução prontuário eletrônico
- SBIS — Certificação NGS1/NGS2
- `DECISOES.md` — imutabilidade e assinatura (Fase 4 / atualização 16D)
