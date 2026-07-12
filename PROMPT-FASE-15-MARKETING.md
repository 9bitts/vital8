# PROMPT FASE 15 — MÓDULO DE MARKETING E CAPTAÇÃO (copiar e colar no Cursor após concluir a Fase 14)

---

Fase 14 validada. Execute agora a **FASE 15 — MARKETING E CAPTAÇÃO DE PACIENTES**: funil de captação (lead → paciente), landing pages, campanhas, rastreamento de origem e ROI por canal. Regras: consentimento LGPD explícito para comunicação de marketing (separado do transacional — base da Fase 8), publicidade em saúde respeitando limites éticos dos conselhos (CFM/CRO — sem promessa de resultado, seed de templates já em conformidade), e integrações de anúncios atrás de adapters. Todas as regras invioláveis do prompt mestre continuam valendo.

## Escopo obrigatório

### 15.1 CRM de captação (funil de leads)

**Models:** `Lead` (nome, telefone, e-mail, interesse — serviço —, origem/canal + UTMs completos, status NOVO/EM_CONTATO/AGENDOU/COMPARECEU/CONVERTIDO/PERDIDO com motivo de perda, responsável, unidade, consentimento de marketing com timestamp/IP, `patientId` quando converte), `LeadInteraction` (ligação, WhatsApp, e-mail, nota — com data e usuário), `LeadSource` (canal configurável: Instagram, Google, indicação, fachada, parceria...), `MarketingCampaign` (nome, canal, período, investimento em centavos, UTM padrão), `LandingPage` (ver 15.2), `ReferralProgram` + `Referral` (indicação: paciente indica → recompensa configurável — desconto/cortesia — creditada quando o indicado comparece; anti-fraude: limite por paciente, auditoria).

**Funcionalidades:**

1. **Kanban do funil** `/app/marketing/leads`: colunas por status, drag-and-drop, cartão com origem/interesse/tempo parado (alerta de lead esfriando configurável), filtros por canal/campanha/responsável/período.
2. Captura automática de lead: formulário das landing pages, agendamento online da Fase 8 (novo cadastro = lead CONVERTIDO automático), secretária IA da Fase 12 (conversa sem agendamento = lead EM_CONTATO com transcrição), entrada manual e importação CSV.
3. Conversão: botão "converter em paciente" (reusa cadastro da Fase 2, deduplicação por telefone/CPF) e vínculo automático quando o lead agenda; a origem/UTM fica gravada NO PACIENTE para sempre (custo de aquisição por paciente).
4. Cadência de follow-up: régua específica de leads na infra da Fase 8 (ex.: novo lead → resposta em 5 min via template; sem resposta → D+1, D+3; agendou e não compareceu → resgate D+2) — sempre respeitando opt-in de marketing.
5. Tarefas de contato para a equipe (ligar para lead X) integradas ao centro de notificações.

### 15.2 Landing pages e presença

1. Construtor simples de landing pages públicas `/lp/[orgSlug]/[slug]`: blocos pré-prontos (hero com CTA, serviços, profissionais com mini-bio e conselho, depoimentos — com consentimento registrado —, FAQ, mapa/contato, formulário de captação com consentimento LGPD obrigatório e link da política de privacidade); editor com preview, publicar/despublicar, SEO básico (title/description/OG), tema com cores/logo da clínica.
2. **Mini-site da clínica** `/c/[orgSlug]`: página institucional gerada dos dados existentes (unidades, serviços, profissionais, horários) + botões agendar online (Fase 8) e WhatsApp; sitemap.xml e dados estruturados schema.org (MedicalClinic/Physician).
3. Formulários independentes embutíveis (`<script>` embed) para site próprio da clínica, apontando para a captura de leads.
4. Rate limiting e anti-spam (honeypot + desafio leve) em todos os formulários públicos.

### 15.3 Campanhas, rastreamento e ROI

1. Rastreamento: toda entrada pública (landing, mini-site, agendamento online) captura UTMs e `LeadSource`; link curto rastreável por campanha (`/r/[code]` → redireciona e registra clique).
2. Adapters de pixels/eventos (`src/lib/integrations/ads/`): interface para Meta Pixel/Conversions API e Google Ads/GA4 — mock em dev; eventos: page_view, lead, agendamento, comparecimento (conversão offline) — SEM enviar dados de saúde, apenas eventos com identificadores hasheados e consentimento (documentar em DECISOES.md — dados sensíveis nunca vão para plataformas de anúncio).
3. **Dashboard de marketing** (integra BI da Fase 9): leads por canal/campanha, taxa de conversão por etapa do funil, tempo médio de resposta ao lead, **CAC por canal** (investimento da campanha ÷ pacientes convertidos), **LTV estimado** (receita média do paciente na Fase 5 por coorte de origem), ROI por campanha, ranking de indicadores do programa de indicação, receita de pacientes novos × recorrentes.
4. Relatório de reativação: pacientes inativos (sem atendimento há X meses, da Fase 9) → campanha de reativação segmentada (régua da Fase 8) com acompanhamento de retorno efetivo.

### 15.4 Reputação

1. Pós-atendimento: promotores do NPS (Fase 8, nota ≥ 9) recebem convite automático para avaliar no Google (link do perfil da clínica — campo em configurações); detratores NUNCA recebem (regra testada).
2. Central de depoimentos: solicitar, receber com consentimento explícito de publicação, aprovar e publicar nas landing pages.

**Permissões:** perfil MARKETING via permissões finas da Fase 10 (leads e campanhas, SEM prontuário nem financeiro completo); RECEPCAO opera leads; landing pages e programa de indicação: ADMIN/OWNER. **Feature flag:** marketing em PRO/ENTERPRISE; landing pages ilimitadas apenas ENTERPRISE.

**Seed:** 3 canais, 1 campanha com investimento, ~15 leads distribuídos no funil (com UTMs variados, 4 convertidos com receita para o CAC/LTV fazer sentido), 1 landing publicada, programa de indicação ativo com 2 indicações.

## Testes obrigatórios

Conversão lead→paciente com deduplicação; UTM persistida até o paciente; cálculo de CAC e LTV por coorte (dataset determinístico); detrator nunca recebe convite de avaliação; formulário público sem consentimento é rejeitado; opt-out bloqueia cadência; anti-fraude de indicação; isolamento multi-tenant (leads, landings, campanhas); nenhum evento de ads contém dado de saúde (teste no payload do adapter).

## Entrega

`npx tsc --noEmit` limpo, `npm run build` verde, `npm test` passando, migrations aplicáveis, README.md com checklist manual da Fase 15 (publicar landing, capturar lead com UTM, cadência dispara, arrastar no kanban, converter e agendar, comparecimento fecha o funil, dashboard com CAC/ROI, indicação premiada, promotor recebe link do Google) e DECISOES.md atualizado (política de dados em plataformas de anúncio, conformidade ética de publicidade em saúde). Se dividir (15A funil+leads+cadência, 15B landing pages+mini-site+rastreamento, 15C dashboard ROI+indicação+reputação), apresente o plano e execute na sequência.

Comece.
