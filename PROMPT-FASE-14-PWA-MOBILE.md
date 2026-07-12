# PROMPT FASE 14 — PWA / APP MOBILE DO PROFISSIONAL COM OFFLINE (copiar e colar no Cursor após concluir a Fase 13)

---

Fase 13 validada. Execute agora a **FASE 14 — PWA MOBILE DO PROFISSIONAL**: transformar o Vital8 em Progressive Web App instalável (Android/iOS/desktop) com uma experiência mobile dedicada ao profissional de saúde, incluindo **agenda offline**. Princípio central: offline é MODO DE LEITURA + ações enfileiradas — dados clínicos sensíveis têm regras próprias de cache, e nenhum conflito de sincronização pode corromper dados. Todas as regras invioláveis do prompt mestre continuam valendo.

## Escopo obrigatório

### 14.1 Fundação PWA

1. `manifest.webmanifest` completo (nome, ícones maskable em todos os tamanhos, tema, `display: standalone`, atalhos: Agenda de hoje, Fila, Novo agendamento), splash screens iOS, prompt de instalação customizado (banner discreto após 2º acesso, dispensável).
2. Service Worker com **Serwist** (sucessor do next-pwa, compatível com App Router — se inviável, justificar alternativa em DECISOES.md): precache do shell, runtime cache estático (stale-while-revalidate), páginas de fallback offline.
3. Estratégias de cache POR SENSIBILIDADE (documentar em DECISOES.md): estáticos → cache-first; dados operacionais (agenda, lista de pacientes SEM conteúdo clínico) → network-first com fallback ao cache criptografado; **conteúdo clínico (prontuário, prescrições) → NUNCA em cache persistente** — apenas memória da sessão; dados financeiros → network-only.
4. Cache local de dados em IndexedDB **criptografado** (AES-GCM com chave derivada da sessão via Web Crypto; logout/expiração = purge total do cache e do IndexedDB — testar).
5. Notificações push (Web Push/VAPID) atrás de adapter `push`: próxima consulta, paciente fez check-in, resultado de exame recebido, mensagem da secretária IA escalada — preferências por usuário no centro de notificações da Fase 9.

### 14.2 Experiência mobile do profissional

Rotas `/m/*` (layout mobile-first dedicado, bottom navigation: Hoje · Agenda · Pacientes · Notificações · Perfil), detectando viewport e oferecendo alternância:

1. **Hoje:** cards da fila do dia (status ao vivo, paciente com check-in destacado, tempo de espera), botão "chamar paciente" (painel da Fase 3), swipe para confirmar/faltou, resumo do dia (atendidos, faltas, próximo livre).
2. **Agenda:** dia/semana verticais otimizadas para toque, criar agendamento rápido, bloqueio rápido de horário ("almoço", "imprevisto"), visão das próximas 2 semanas.
3. **Paciente (visão mobile):** cabeçalho com alertas de alergia, linha do tempo, telefonar/WhatsApp em um toque; conteúdo clínico apenas online (ver 14.1.3) com `RecordAccessLog` normal.
4. **Atendimento mobile:** versão enxuta da tela da Fase 4 — SOAP simplificado, ditado por voz (adapter da Fase 12), prescrição com autocomplete, assinar; otimizada para consulta domiciliar/teleconsulta pelo celular.
5. **Repasse:** extrato do profissional (Fase 5) somente leitura.
6. Gestos e ergonomia: pull-to-refresh, skeleton loaders, área de toque ≥ 44px, dark mode (respeitando `prefers-color-scheme`).

### 14.3 Agenda offline e fila de sincronização

1. **Sincronização de leitura:** ao abrir com rede, snapshot da agenda do profissional (período: 7 dias atrás → 14 à frente) + dados mínimos dos pacientes agendados (nome, telefone, convênio, alertas de alergia — SEM prontuário) gravado no IndexedDB criptografado; indicador visível de "última sincronização" e banner claro de modo offline.
2. **Ações offline enfileiradas** (`OfflineActionQueue` no IndexedDB): confirmar, marcar falta, iniciar/finalizar sem conteúdo clínico, bloquear horário, criar agendamento provisório (marcado PROVISORIO_OFFLINE), anotação pessoal não-clínica. Escrever prontuário offline NÃO é permitido nesta fase (documentar em DECISOES.md — integridade/assinatura exigem servidor).
3. **Sincronização de escrita:** ao voltar a rede (Background Sync API + fallback no foreground), fila processada em ordem com `Idempotency-Key` (reusar infra da Fase 11); **conflitos** (ex.: horário ocupado enquanto offline, transição de estado inválida) → ação rejeitada vai para "Pendências de sincronização" com resolução manual clara (nunca sobrescrever silenciosamente — last-write-wins é proibido para agendamento).
4. Server: endpoint de sync delta (`?updatedAfter=`, reusar padrão da Fase 11) retornando mudanças da janela; versionamento otimista (`version`/`updatedAt` check) nas mutações vindas da fila.
5. Telemetria: log de sincronizações (duração, ações aplicadas/rejeitadas) para depuração em `/app/sistema`.

**Permissões:** experiência `/m/*` disponível para todos os papéis com layout adequado (recepção vê Hoje+Agenda; financeiro não tem modo offline). Offline: apenas PROFISSIONAL e RECEPCAO. **Feature flag:** PWA/offline em PRO/ENTERPRISE.

## Testes obrigatórios

Unit: fila offline (ordem, idempotência, conflito → pendência), criptografia do cache local, purge no logout, delta sync. E2E (Playwright com emulação mobile e `context.setOffline`): instalar → sincronizar → ficar offline → confirmar consulta + criar agendamento provisório → voltar online → sincronizar e verificar no desktop; conflito offline (mesmo slot ocupado no servidor) vira pendência manual; conteúdo clínico inacessível offline; Lighthouse PWA ≥ 90 documentado.

## Entrega

`npx tsc --noEmit` limpo, `npm run build` verde, `npm test` e `npm run test:e2e` passando, README.md com checklist manual da Fase 14 (instalar no Android/iOS, push de check-in, fluxo offline completo do celular em modo avião, pendência de conflito, dark mode, purge no logout) e DECISOES.md atualizado (Serwist, política de cache por sensibilidade, por que prontuário não é editável offline). Se dividir (14A PWA+cache+push, 14B experiência mobile `/m/*`, 14C offline+sync), apresente o plano e execute na sequência.

Comece.
