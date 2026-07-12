import { computeTissBatchHash } from "./hash";
import type { TissGuidePayload } from "./types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildGuideXml(guide: TissGuidePayload, guideType: string): string {
  const procedures = guide.procedimentos
    .map(
      (p) => `
        <procedimentoExecutado>
          <codigoProcedimento>${escapeXml(p.tussCode)}</codigoProcedimento>
          <descricaoProcedimento>${escapeXml(p.term)}</descricaoProcedimento>
          <quantidadeExecutada>${p.quantity}</quantidadeExecutada>
          <valorUnitario>${(p.unitValueCents / 100).toFixed(2)}</valorUnitario>
          <valorTotal>${(p.totalValueCents / 100).toFixed(2)}</valorTotal>
          <dataExecucao>${escapeXml(p.executionDate)}</dataExecucao>
        </procedimentoExecutado>`,
    )
    .join("");

  const consultaBlock =
    guideType === "GUIA_CONSULTA" && guide.tipoConsulta
      ? `<tipoConsulta>${escapeXml(guide.tipoConsulta)}</tipoConsulta>`
      : "";

  const cidBlock = guide.cid10
    ? `<diagnostico><codigoDiagnostico>${escapeXml(guide.cid10)}</codigoDiagnostico></diagnostico>`
    : "";

  const authBlock = guide.senhaAutorizacao
    ? `<senhaAutorizacao>${escapeXml(guide.senhaAutorizacao)}</senhaAutorizacao>`
    : "";

  return `
    <guia${guideType === "GUIA_CONSULTA" ? "Consulta" : "SP-SADT"}>
      <cabecalhoGuia>
        <registroANS>${escapeXml(guide.registroANS)}</registroANS>
        <numeroGuiaPrestador>${escapeXml(guide.numeroGuiaPrestador)}</numeroGuiaPrestador>
      </cabecalhoGuia>
      <dadosBeneficiario>
        <numeroCarteira>${escapeXml(guide.dadosBeneficiario.numeroCarteira)}</numeroCarteira>
        <nomeBeneficiario>${escapeXml(guide.dadosBeneficiario.nomeBeneficiario)}</nomeBeneficiario>
        ${guide.dadosBeneficiario.validadeCarteira ? `<validadeCarteira>${escapeXml(guide.dadosBeneficiario.validadeCarteira)}</validadeCarteira>` : ""}
      </dadosBeneficiario>
      <dadosContratadoExecutante>
        ${guide.dadosContratadoExecutante.codigoCNES ? `<codigoCNES>${escapeXml(guide.dadosContratadoExecutante.codigoCNES)}</codigoCNES>` : ""}
        ${guide.dadosContratadoExecutante.cnpjContratado ? `<cnpjContratado>${escapeXml(guide.dadosContratadoExecutante.cnpjContratado)}</cnpjContratado>` : ""}
        ${guide.dadosContratadoExecutante.cpfContratado ? `<cpfContratado>${escapeXml(guide.dadosContratadoExecutante.cpfContratado)}</cpfContratado>` : ""}
      </dadosContratadoExecutante>
      <profissionalExecutante>
        <nomeProfissional>${escapeXml(guide.profissionalExecutante.nomeProfissional)}</nomeProfissional>
        ${guide.profissionalExecutante.conselhoProfissional ? `<conselhoProfissional>${escapeXml(guide.profissionalExecutante.conselhoProfissional)}</conselhoProfissional>` : ""}
        ${guide.profissionalExecutante.numeroConselho ? `<numeroConselhoProfissional>${escapeXml(guide.profissionalExecutante.numeroConselho)}</numeroConselhoProfissional>` : ""}
        ${guide.profissionalExecutante.ufConselho ? `<ufConselho>${escapeXml(guide.profissionalExecutante.ufConselho)}</ufConselho>` : ""}
      </profissionalExecutante>
      <dadosAtendimento>
        <indicacaoAcidente>${escapeXml(guide.indicacaoAcidente)}</indicacaoAcidente>
        <caraterAtendimento>${escapeXml(guide.caraterAtendimento)}</caraterAtendimento>
        ${consultaBlock}
        <dataAtendimento>${escapeXml(guide.dataAtendimento)}</dataAtendimento>
        <horaAtendimento>${escapeXml(guide.horaAtendimento)}</horaAtendimento>
        ${authBlock}
      </dadosAtendimento>
      ${cidBlock}
      <procedimentosExecutados>${procedures}
      </procedimentosExecutados>
    </guia${guideType === "GUIA_CONSULTA" ? "Consulta" : "SP-SADT"}>`;
}

export type BatchXmlInput = {
  tissVersion: string;
  ansRegistration: string;
  providerDocument: string;
  providerCodeAtInsurer?: string | null;
  providerCnes?: string | null;
  batchNumber: number;
  competence: string;
  guides: Array<{ guideType: string; payload: TissGuidePayload }>;
};

export type BatchXmlResult = {
  xml: string;
  hash: string;
};

export function buildTissBatchXml(input: BatchXmlInput): BatchXmlResult {
  const guidesXml = input.guides
    .map((g) => buildGuideXml(g.payload, g.guideType))
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<mensagemTISS xmlns="http://www.ans.gov.br/padroes/tiss/schemas" versao="${escapeXml(input.tissVersion)}">
  <cabecalho>
    <identificacaoTransacao>
      <tipoTransacao>ENVIO_LOTE_GUIAS</tipoTransacao>
      <sequencialTransacao>${input.batchNumber}</sequencialTransacao>
      <dataRegistroTransacao>${new Date().toISOString().slice(0, 10)}</dataRegistroTransacao>
      <horaRegistroTransacao>${new Date().toISOString().slice(11, 19)}</horaRegistroTransacao>
    </identificacaoTransacao>
    <origem>
      <identificacaoPrestador>
        ${input.providerCnes ? `<codigoCNES>${escapeXml(input.providerCnes)}</codigoCNES>` : ""}
        <cnpjContratado>${escapeXml(input.providerDocument)}</cnpjContratado>
        ${input.providerCodeAtInsurer ? `<codigoPrestadorNaOperadora>${escapeXml(input.providerCodeAtInsurer)}</codigoPrestadorNaOperadora>` : ""}
      </identificacaoPrestador>
    </origem>
    <destino>
      <registroANS>${escapeXml(input.ansRegistration)}</registroANS>
    </destino>
    <competencia>${escapeXml(input.competence)}</competencia>
  </cabecalho>
  <prestadorParaOperadora>
    <loteGuias>
      <numeroLote>${input.batchNumber}</numeroLote>
      <guias>${guidesXml}
      </guias>
    </loteGuias>
  </prestadorParaOperadora>`;

  const hash = computeTissBatchHash(body);
  const xml = `${body}
  <epilogo>
    <hash>${hash}</hash>
  </epilogo>
</mensagemTISS>`;

  return { xml, hash };
}
