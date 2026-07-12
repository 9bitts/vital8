import type { GuideValidationInput } from "../shared/guide-validation";
import type { TissValidationError } from "../../types";
import { validateGuideFieldsBase } from "../shared/guide-validation";

const REQUIRED_XML_MARKERS_403 = [
  "mensagemTISS",
  "cabecalho",
  "identificacaoTransacao",
  "componenteOrganizacional",
  "identificacaoSoftware",
  "prestadorParaOperadora",
  "loteGuias",
  "epilogo",
  "hash",
] as const;

export function validateXmlStructure403(xml: string): TissValidationError[] {
  const errors: TissValidationError[] = [];

  for (const marker of REQUIRED_XML_MARKERS_403) {
    if (!xml.includes(`<${marker}`) && !xml.includes(`<${marker}>`)) {
      errors.push({ field: marker, message: `Elemento obrigatório ausente (4.03): ${marker}` });
    }
  }

  const hashMatch = xml.match(/<hash>([a-f0-9]{32})<\/hash>/i);
  if (!hashMatch) {
    errors.push({ field: "hash", message: "Hash MD5 inválido ou ausente no epílogo" });
  }

  if (!xml.includes('xmlns="http://www.ans.gov.br/padroes/tiss/schemas"')) {
    errors.push({ field: "xmlns", message: "Namespace TISS ANS ausente" });
  }

  if (!xml.includes('versao="4.03.00"')) {
    errors.push({ field: "versao", message: "Atributo versao deve ser 4.03.00" });
  }

  if (!xml.includes("<codigoTabela>22</codigoTabela>")) {
    errors.push({ field: "codigoTabela", message: "Tabela TUSS 22 obrigatória em procedimentos (4.03)" });
  }

  return errors;
}

export function validateGuideFields403(input: GuideValidationInput): TissValidationError[] {
  const errors = validateGuideFieldsBase(input);

  if (!input.providerCnes?.trim()) {
    errors.push({
      field: "providerCnes",
      message: "CNES obrigatório para TISS 4.03 (componente organizacional)",
    });
  }

  return errors;
}
