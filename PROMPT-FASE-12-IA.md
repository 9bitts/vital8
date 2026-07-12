# PROMPT FASE 12 — INTELIGÊNCIA ARTIFICIAL APLICADA (copiar e colar no Cursor após concluir a Fase 11)

---

Fase 11 validada. Execute agora a **FASE 12 — IA APLICADA**: os recursos de IA que diferenciam o Vital8 dos concorrentes (secretária virtual, copiloto clínico, cobrança inteligente e insights). Princípio central: **IA sugere, humano decide** — nenhuma ação clínica, financeira ou de comunicação é executada sem revisão/configuração humana explícita, e nenhum dado identificável de paciente sai do sistema sem base legal registrada. Todas as regras invioláveis do prompt mestre continuam valendo.

## Escopo obrigatório

### 12.1 Infraestrutura de IA

1. Adapter `llm` em `src/lib/integrations/llm/`: interface única (`complete`, `stream`, `transcribe`) com implementações **mock determinística** (dev/testes) e **provider real plugável** (Anthropic/OpenAI via env vars — implementar o client da Anthropic como referência, sem chave = mock automático).
2. **Privacidade por camada:** antes de qualquer chamada externa, pipeline de minimização — remover/pseudonimizar identificadores (nome→iniciais, sem CPF/telefone/endereço); tabela `AiDataProcessingConsent` por organização (OWNER habilita cada recurso de IA ciente do fluxo de dados, com versão do termo); recursos clínicos de IA só funcionam com consentimento ativo; tudo documentado em DECISOES.md.
3. `AiInteractionLog` (recurso usado, usuário, tokens, latência, aceito/editado/rejeitado pelo humano — métrica de utilidade) — sem armazenar payload com PHI em claro (criptografar com `phi.ts`).
4. `AiSettings` por organização: liga/desliga por recurso, modelo, temperatura, idioma. Feature flag: IA em plano ENTERPRISE (ou add-on — documentar).
5. Custos: contador de uso mensal por organização com limite configurável e alerta a 80%.

### 12.2 Secretária virtual (WhatsApp/chat)

1. Motor de conversa sobre o adapter de mensageria da Fase 8: paciente escreve → intenção classificada (agendar, remarcar, cancelar, confirmar, dúvida de preparo, horário de funcionamento, humano) → fluxo correspondente usando os MESMOS services (disponibilidade real da Fase 3, regras do agendamento online da Fase 8, identificação por telefone).
2. Guardrails: nunca responde pergunta clínica (encaminha ao profissional), nunca inventa horário/preço (só dados do sistema), handoff para humano a qualquer momento (fila na recepção com contexto da conversa), horário de silêncio configurável.
3. Simulador de conversa em `/app/configuracoes` → IA (testar sem WhatsApp real) + histórico de conversas na central de comunicação com transcrição e resultado (agendou? escalou?).
4. FAQ configurável pela clínica (perguntas/respostas aprovadas que a IA pode usar).

### 12.3 Copiloto clínico (dentro do atendimento, Fase 4)

1. **Resumo do histórico:** botão "Resumir histórico" gera síntese dos encontros anteriores (queixas recorrentes, medicamentos, alertas) no painel lateral — marcada como "gerado por IA", nunca gravada no prontuário automaticamente.
2. **Ditado e estruturação:** transcrição de áudio (adapter `transcribe`; dev = mock) e conversão de texto livre ditado em SOAP estruturado — profissional revisa e edita ANTES de salvar; diff visível do que a IA estruturou.
3. **Sugestão de CID-10:** a partir do texto da hipótese, sugere códigos da tabela local (busca semântica simples ou via LLM) — sempre múltiplas opções, escolha manual.
4. **Rascunho de documentos:** atestado/encaminhamento/orientações pós-consulta a partir do contexto do encontro — sempre como rascunho editável.
5. Rodapé fixo em todo recurso clínico: "Conteúdo assistido por IA — revisado e assinado pelo profissional" (registro de quem revisou no AiInteractionLog).

### 12.4 Gestão e receita inteligentes

1. **Cobrança inteligente (Fase 5):** score simples de risco de inadimplência (heurística sobre histórico — sem caixa-preta: fatores exibidos) para priorizar régua; texto de cobrança personalizado por IA dentro de template aprovado.
2. **Anti no-show (Fase 3):** score de risco de falta por agendamento (histórico do paciente, dia/hora, antecedência) → recepção vê ranking e a régua pode intensificar confirmação dos de alto risco; overbooking assistido opcional (sugerir encaixe onde risco agregado é alto) — sempre sugestão, nunca automático.
3. **Insights do BI (Fase 9):** card "Insights do mês" no dashboard executivo — 3 a 5 observações geradas sobre os agregados (ex.: "no-show de segunda-feira 2× acima da média; considere régua reforçada") com link para o relatório fonte; botão "explicar este gráfico".
4. **Resposta a glosas (Fase 6):** rascunho de justificativa de recurso a partir do motivo da glosa + dados da guia — revisão obrigatória do faturista.

### 12.5 Busca inteligente global

Barra de busca global (`Cmd/Ctrl+K`) que já busca pacientes/telas/ações; adicionar interpretação de linguagem natural ("agenda da Dra. Paula amanhã", "vencidos do convênio X") → roteia para a tela/filtro correto. Fallback sempre para busca literal.

## Testes obrigatórios

Mock determinístico em todos os testes (nunca chamar provider real em CI); pipeline de minimização remove identificadores (teste com fixtures de PHI); recurso clínico bloqueado sem `AiDataProcessingConsent`; secretária nunca oferece horário inexistente (propriedade: toda sugestão ∈ slots reais); score de no-show é reprodutível; limite de uso bloqueia com mensagem correta; AiInteractionLog criptografado; isolamento multi-tenant do contexto (conversa da org A jamais recebe dado da org B — teste crítico).

## Entrega

`npx tsc --noEmit` limpo, `npm run build` verde, `npm test` passando, migrations aplicáveis, README.md com checklist manual da Fase 12 (habilitar IA com consentimento, simular conversa de agendamento ponta a ponta, resumo de histórico + aceite/rejeição, ditado → SOAP com revisão, sugestão de CID, score de no-show na recepção, insight no dashboard, rascunho de recurso de glosa, busca natural, estourar limite de uso) e DECISOES.md atualizado (provider, minimização, posição regulatória — IA como apoio, decisão sempre do profissional, alinhado às diretrizes CFM sobre suporte à decisão). Se dividir (12A infra+consentimento+adapter, 12B secretária virtual, 12C copiloto clínico, 12D gestão inteligente+busca), apresente o plano e execute na sequência.

Comece.
