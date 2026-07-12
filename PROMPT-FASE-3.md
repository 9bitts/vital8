# PROMPT FASE 3 — AGENDA E RECEPÇÃO (copiar e colar no Cursor após concluir a Fase 2)

---

Fase 2 validada. Execute agora a **FASE 3 — AGENDA E RECEPÇÃO** completa, conforme o prompt mestre. Reforço do escopo e critérios de aceite:

## Escopo obrigatório

**Models (migrations incrementais):**
`Professional` (vínculo opcional com User, nome, conselho — CRM/CRO/CREFITO/CRP/CRN —, número e UF do conselho, especialidades, cor na agenda, ativo), `Service` (nome, categoria, duração em minutos, preço particular, código TUSS opcional, instruções de preparo, permite agendamento online — flag para a Fase 8, ativo), `Room` (sala/recurso), `ScheduleTemplate` (grade semanal por profissional: dia, hora início/fim, intervalo entre slots, sala padrão) + `ScheduleException` (bloqueios pontuais, férias), `Holiday` (feriados da organização), `Appointment` (paciente, profissional, serviço, sala opcional, início/fim, status, origem — RECEPCAO/TELEFONE/ONLINE —, convênio do paciente ou particular, valor previsto, observações, encaixe boolean, recorrência via `recurrenceGroupId`), `AppointmentStatusHistory` (transições com usuário e timestamp), `WaitingListEntry` (paciente, serviço, profissional preferido, período preferido, prioridade), `AppointmentConfirmation` (canal, token público, status, respondido em).

**Máquina de estados do Appointment (transições auditadas):**
AGENDADO → CONFIRMADO → AGUARDANDO (check-in) → EM_ATENDIMENTO → FINALIZADO · e a partir de qualquer estado pré-atendimento: FALTOU, CANCELADO, REMARCADO (remarcar cria novo Appointment ligado ao original). Registrar hora de chegada e hora de início para calcular tempo de espera.

**Regras técnicas:**

1. Conflitos: impedir sobreposição por profissional, sala e paciente; encaixe só com flag explícita + permissão + auditoria.
2. Slots gerados a partir de ScheduleTemplate − exceções − feriados − ocupados; duração do slot = duração do Service.
3. Recorrência: criar N sessões semanais/quinzenais de uma vez (fisio/psico), com tratamento de conflitos por sessão (pular/encaixar/escolher outro horário).
4. Confirmação: ao agendar, gerar link público `/confirmar/[token]` (confirmar/cancelar sem login) e disparar mensagem via adapter de mensageria (`src/lib/integrations/messaging/`, implementação console/mock em dev, interface pronta para WhatsApp/SMS/e-mail). Resposta atualiza status e audita.
5. Tudo via `tenantClient` + teste de isolamento para Appointment; testes unitários da detecção de conflito e da geração de slots (casos: sobreposição parcial, encaixe, feriado, exceção, recorrência).

**Telas:**

1. `/app/agenda`: visões dia/semana/mês; dia com multi-profissional em colunas lado a lado; cores por profissional e por status; criar por clique no slot vago (modal: buscar paciente ou cadastro rápido da Fase 2, serviço, convênio/particular); drag-and-drop para remarcar (com confirmação); filtros por profissional, sala, serviço, status; navegação por teclado e atalho "hoje".
2. `/app/recepcao`: fila do dia ao vivo — chegada (check-in em um clique), tempo de espera com alerta visual acima do limite configurável, próximos horários, faltas do dia; ações rápidas (confirmar, remarcar, cancelar com motivo).
3. Painel de chamada público `/painel/[orgSlug]` (rota sem login, para TV da sala de espera): última chamada em destaque (nome social/primeiro nome + sala) + histórico das 5 anteriores, com senha sequencial por chegada; atualização em tempo quase real (polling ou SSE — documentar escolha em DECISOES.md); botão "chamar" na tela da recepção e do profissional. Não exibir dados sensíveis (só primeiro nome + inicial do sobrenome).
4. Lista de espera: cadastrar interessado; quando um horário compatível vaga (cancelamento), sugerir automaticamente os candidatos na tela da recepção.
5. Configurações: profissionais (CRUD + grade semanal com editor visual), serviços, salas, feriados (importar feriados nacionais do ano via seed), limite de tempo de espera.
6. Relatórios: ocupação por profissional (slots ocupados/disponíveis), taxa de no-show por profissional e por dia da semana, atendimentos por origem.
7. Linha do tempo do paciente (Fase 2) passa a exibir consultas passadas e futuras.

**Permissões:** RECEPCAO gerencia agenda e fila; PROFISSIONAL vê a própria agenda (e das outras, configurável) e chama paciente; encaixe e cancelamento em massa exigem ADMIN/OWNER ou permissão explícita.

**Seed:** grades para os profissionais existentes + ~30 agendamentos distribuídos (passados com FINALIZADO/FALTOU para alimentar relatórios, futuros em vários status) nas duas organizações.

## Entrega

`npx tsc --noEmit` limpo, `npm run build` verde, `npm test` passando (conflitos, slots, recorrência, isolamento), migrations aplicáveis, README.md com checklist manual da Fase 3 (agendar, confirmar por link público, check-in, chamar no painel, remarcar por drag-and-drop, relatório de no-show) e DECISOES.md atualizado. Se dividir em etapas (3A cadastros+grade+agenda, 3B recepção+painel+confirmação+relatórios), apresente o plano e execute na sequência.

Comece.
