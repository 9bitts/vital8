# PROMPT FASE 4 — PRONTUÁRIO ELETRÔNICO (copiar e colar no Cursor após concluir a Fase 3)

---

Fase 3 validada. Execute agora a **FASE 4 — PRONTUÁRIO ELETRÔNICO (PEP)** completa, conforme o prompt mestre. Este é o módulo mais sensível do sistema: imutabilidade, auditoria e criptografia são inegociáveis. Reforço do escopo e critérios de aceite:

## Escopo obrigatório

**Models (migrations incrementais):**
`Encounter` (atendimento clínico: vinculado ao Appointment quando houver, paciente, profissional, modalidade PRESENCIAL/TELECONSULTA, início/fim, status RASCUNHO/ASSINADO, `contentHash` SHA-256 gravado na assinatura, `signedAt`), `EncounterSection` (seções tipadas: ANAMNESE, EXAME_FISICO, EVOLUCAO_SOAP com campos S/O/A/P, HIPOTESE_DIAGNOSTICA com códigos CID-10, CONDUTA — conteúdo livre criptografado com `phi.ts`), `Cid10Code` (seed da tabela CID-10 pesquisável por código e descrição), `FormTemplate` + `FormTemplateVersion` + `FormResponse` (construtor de formulários: campos texto, número, escolha única/múltipla, escala, data, tabela; versionado — resposta sempre aponta para a versão usada), `Prescription` + `PrescriptionItem` (medicamento, concentração, forma, posologia, via, duração, quantidade; tipo COMUM ou CONTROLE_ESPECIAL — layout portaria 344 em duas vias), `DrugCatalog` (seed local de ~200 medicamentos comuns para autocomplete; adapter `prescription-provider` preparado para Memed), `MedicalCertificate` (tipo atestado/declaração/comparecimento, template com variáveis, CID opcional com consentimento do paciente registrado), `DocumentTemplate` (templates editáveis pela clínica com variáveis {{paciente}}, {{profissional}}, {{data}}, {{cid}}, {{dias}}...), `ExamRequest` + itens, `ExamResult` (anexo via storage adapter + valores estruturados opcionais nome/valor/unidade/referência), `Odontogram` + `OdontogramEntry` (dente FDI, faces, achado/procedimento, status), `BodyChartEntry` (mapa corporal com marcações x/y + anotação), `EncounterAmendment` (adendo pós-assinatura: autor, timestamp, conteúdo criptografado — nunca altera o original), `RecordAccessLog` (toda visualização de prontuário: quem, quando, o quê, IP).

**Regras técnicas (imutabilidade — norte SBIS/NGS2):**

1. Encounter ASSINADO é imutável: gravar `contentHash` do conteúdo canônico serializado; qualquer correção vira `EncounterAmendment`. Sem update nem delete físico — bloquear no service e testar.
2. Assinatura atrás do adapter `digital-signature` (`src/lib/integrations/digital-signature/`): dev = assinatura simples registrada (usuário+hash+timestamp); interface pronta para ICP-Brasil (A1/A3/nuvem) no futuro.
3. Todo conteúdo clínico livre criptografado com `phi.ts`. CID-10 e metadados estruturados podem ficar em claro para relatórios — documentar em DECISOES.md.
4. `RecordAccessLog` em toda leitura de Encounter/Prescription/ExamResult — sem exceção.
5. Registro reservado (psicologia): seção marcada `restrictedToAuthor` visível apenas ao autor (nem OWNER acessa o conteúdo; a existência é visível).
6. PDFs (receita, atestado, solicitação de exame) gerados server-side com cabeçalho da clínica (logo, endereço, profissional + conselho), receituário de controle especial no layout de duas vias.
7. Testes: imutabilidade pós-assinatura, hash de integridade, criptografia das seções, isolamento multi-tenant de Encounter, permissões (FINANCEIRO/RECEPCAO sem acesso a conteúdo clínico), registro reservado.

**Telas:**

1. Fluxo do atendimento: na agenda/recepção, botão "Iniciar atendimento" (status → EM_ATENDIMENTO) abre `/app/atendimento/[id]` com cronômetro; ao finalizar e assinar, Appointment → FINALIZADO.
2. Tela de atendimento em duas colunas: esquerda = histórico completo do paciente (encontros anteriores, resultados, prescrições — colapsáveis); direita = editor do encontro atual (seções conforme template da especialidade). Alerta permanente no topo: alergias e condições crônicas em destaque vermelho.
3. Templates por especialidade (seed): medicina geral (anamnese + SOAP), odontologia (com odontograma interativo — SVG clicável por dente/face), fisioterapia (evolução por sessão + plano de tratamento com metas), psicologia (registro reservado), nutrição (antropometria com gráfico de evolução de medidas ao longo dos encontros).
4. Prescrição: autocomplete do catálogo, posologia assistida, múltiplos itens, imprimir/baixar PDF; histórico de prescrições com "repetir receita".
5. Atestados e documentos: escolher template, preencher variáveis, PDF; consentimento registrado quando incluir CID.
6. Solicitação de exames + registro de resultados (upload + valores estruturados); visualizador de anexos (imagem/PDF) inline.
7. Construtor de formulários em Configurações (montar, versionar, ativar por especialidade).
8. Linha do tempo do paciente (Fase 2) passa a exibir encontros, prescrições, exames e documentos.
9. Aba "Acessos" na ficha do paciente (OWNER/ADMIN): trilha de quem visualizou o prontuário.

**Permissões:** conteúdo clínico só PROFISSIONAL (autor e demais profissionais, configurável) e ADMIN/OWNER quando habilitado; RECEPCAO vê apenas existência/datas; FINANCEIRO nada clínico. Assinar: apenas o profissional autor.

**Seed:** ~10 encontros assinados variados (medicina, odonto com odontograma, fisio, nutrição com medidas) + prescrições e um atestado, distribuídos nos pacientes existentes.

## Entrega

`npx tsc --noEmit` limpo, `npm run build` verde, `npm test` passando, migrations aplicáveis, README.md com checklist manual da Fase 4 (iniciar atendimento pela agenda, preencher SOAP, prescrever e gerar PDF, assinar e tentar editar — deve bloquear —, criar adendo, verificar RecordAccessLog, odontograma, registro reservado de psicologia) e DECISOES.md atualizado. Se dividir (4A encounter+seções+assinatura, 4B prescrição+documentos+PDF, 4C especialidades+formulários), apresente o plano e execute na sequência.

Comece.
