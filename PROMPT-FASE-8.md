# PROMPT FASE 8 — RELACIONAMENTO, PORTAL DO PACIENTE E TELEMEDICINA (copiar e colar no Cursor após concluir a Fase 7)

---

Fase 7 validada. Execute agora a **FASE 8 — RELACIONAMENTO, PORTAL DO PACIENTE E TELEMEDICINA** completa, conforme o prompt mestre. Esta fase abre o sistema para fora da clínica: toda rota pública precisa de rate limiting, tokens com expiração e zero vazamento de dados sensíveis. Reforço do escopo e critérios de aceite:

## Escopo obrigatório

**Models (migrations incrementais):**
`CommunicationLog` (central: paciente, canal WHATSAPP/SMS/EMAIL, template usado, conteúdo renderizado, status FILA/ENVIADO/FALHA/RESPONDIDO, referência à origem — confirmação, cobrança, aniversário, NPS, campanha), `MessageTemplate` (por evento, editável, variáveis {{paciente}}, {{data}}, {{hora}}, {{profissional}}, {{clinica}}, {{link}}; versão padrão no seed), `AutomationRule` (réguas configuráveis: evento gatilho, antecedência/atraso, canal, template, ativo — ex.: confirmação H-48 e H-24, lembrete de retorno N dias após atendimento por serviço, aniversário, pós-atendimento/NPS H+2h, cobrança de vencidos da Fase 5), `PatientOptOut` (por canal e por finalidade — transacional × marketing, LGPD), `PatientPortalAccess` (login do paciente: telefone/e-mail + OTP de 6 dígitos com expiração e tentativa limitada, sessão própria separada do Auth.js da equipe), `OnlineBookingConfig` (por organização: serviços habilitados, profissionais habilitados, antecedência mínima/máxima, exige aprovação da clínica, texto de boas-vindas), `TeleconsultConsent` (consentimento específico CFM 2.314: versão do termo, aceite com timestamp e IP), `TeleconsultRoom` (Encounter ↔ sala: link, expiração, atrás do adapter `video`), `NpsSurvey` + `NpsResponse` (nota 0–10, comentário, vinculada ao atendimento), `ReleasedDocument` (liberação explícita de documento do prontuário para o portal: quem liberou, quando, revogável).

**Motor de automações:**

1. Processador de fila: `AutomationRule` gera `CommunicationLog` em FILA; processamento via endpoint `/api/jobs/process` idempotente (chamável por Vercel Cron — documentar setup) + botão manual em dev. Sem dependência de worker externo.
2. Envio via adapter de mensageria existente (mock/console em dev); falha faz retry com backoff limitado; tudo logado.
3. Opt-out respeitado SEMPRE em marketing; transacional (confirmação/cobrança) configurável por paciente. Link de descadastro no rodapé das mensagens de marketing.
4. Testes: agendamento de régua (H-48 correto com fuso America/Sao_Paulo), idempotência (rodar processador 2× não duplica envio), opt-out, renderização de template.

**Portal do paciente e rotas públicas:**

1. `/agendar/[orgSlug]` (público): escolher serviço → profissional (ou "qualquer") → slots livres reais (regras do OnlineBookingConfig) → identificar-se por telefone + OTP (paciente existente reconhecido por hash; novo cria cadastro mínimo) → confirmação; cria Appointment origem=ONLINE (pendente de aprovação se configurado — fila de aprovação na recepção). Rate limiting por IP e por telefone.
2. `/portal/[orgSlug]` (paciente logado por OTP): próximas consultas (cancelar/remarcar conforme regras), histórico de atendimentos (apenas datas/serviços — nunca conteúdo clínico não liberado), documentos liberados (receitas, atestados, resultados — via ReleasedDocument), pagamentos e link de pagamento em aberto (adapter da Fase 5), termos e consentimentos com aceite digital, dados cadastrais com solicitação de correção (vai para fila da recepção, não edita direto).
3. Segurança: sessão do portal isolada (cookie próprio, escopo mínimo), acesso a arquivo só por URL assinada com expiração, `RecordAccessLog` também para acessos do portal, headers de segurança nas rotas públicas.

**Telemedicina (CFM 2.314/2022):**

1. Appointment/Service com flag teleconsulta; agendamento coleta TeleconsultConsent (link enviado antes, aceite obrigatório para iniciar).
2. Profissional inicia do atendimento (Fase 4) → cria TeleconsultRoom via adapter `video` (dev: gera link Jitsi público; interface pronta para provedor com gravação/token); paciente acessa pelo portal ou link direto.
3. Encounter registra modalidade TELECONSULTA, horário de entrada de cada parte e o consentimento vinculado; documentos emitidos são liberados automaticamente no portal (configurável).
4. Tela de pré-consulta: teste de câmera/microfone, aviso de privacidade.

**NPS e campanhas:**

1. Régua pós-atendimento envia link público de pesquisa (token único, expira); resposta grava NpsResponse.
2. Relatório: NPS geral e por profissional, evolução mensal, comentários; detratores geram notificação para ADMIN.
3. Campanha manual simples: filtro de pacientes (tag, convênio, último atendimento antes de X, aniversariantes do mês) → template → fila de envio respeitando opt-out — auditada.

**Telas internas:** central de comunicação (histórico, falhas, reenviar), configuração de réguas e templates com preview, fila de aprovação de agendamentos online, configuração do agendamento online e do portal, gestão de documentos liberados na ficha do paciente, relatório NPS.

**Permissões:** RECEPCAO opera aprovações e comunicação; templates/réguas/campanhas: ADMIN/OWNER; liberar documento clínico: PROFISSIONAL autor ou ADMIN. **Feature flag:** portal, agendamento online e telemedicina em PRO/ENTERPRISE.

**Seed:** templates padrão de todas as réguas, config de agendamento online ativa na Clínica Vida Plena, 1 teleconsulta realizada com consentimento, respostas NPS variadas.

## Entrega

`npx tsc --noEmit` limpo, `npm run build` verde, `npm test` passando, migrations aplicáveis, README.md com checklist manual da Fase 8 (agendar online com OTP, aprovar na recepção, régua de confirmação gera mensagem, confirmar por link, teleconsulta ponta a ponta com consentimento, liberar receita no portal, responder NPS, opt-out bloqueia campanha) e DECISOES.md atualizado (estratégia de cron/fila, fuso horário, segurança das rotas públicas). Se dividir (8A automações+comunicação, 8B agendamento online+portal, 8C telemedicina+NPS+campanhas), apresente o plano e execute na sequência.

Comece.
