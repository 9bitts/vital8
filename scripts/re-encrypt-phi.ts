#!/usr/bin/env tsx
/**
 * Rotação de chave PHI — re-encrypt campos sensíveis.
 * Uso: PHI_ENCRYPTION_KEY_OLD=... PHI_ENCRYPTION_KEY=... tsx scripts/re-encrypt-phi.ts
 *
 * Em produção: executar em janela de manutenção com backup prévio.
 */
console.log(`
[Vital8] Script de re-encrypt PHI (documentação)

1. Defina PHI_ENCRYPTION_KEY_OLD e PHI_ENCRYPTION_KEY novas (32 bytes base64)
2. Para cada Patient/Encounter com cpfEncrypted/contentEncrypted:
   - decrypt com OLD
   - encrypt com NEW
   - update em batch com transação
3. Invalidar sessões ativas após rotação

Implementação completa requer downtime planejado — ver DECISOES.md
`);
