import type { TissValidationError } from "../../types";

const REQUIRED_XML_MARKERS_305 = [
  "mensagemTISS",
  "cabecalho",
  "identificacaoTransacao",
  "prestadorParaOperadora",
  "loteGuias",
  "epilogo",
  "hash",
] as const;

export function validateXmlStructure305(xml: string): TissValidationError[] {
  const errors: TissValidationError[] = [];

  for (const marker of REQUIRED_XML_MARKERS_305) {
    if (!xml.includes(`<${marker}`) && !xml.includes(`<${marker}>`)) {
      errors.push({ field: marker, message: `Elemento obrigatório ausente (3.05): ${marker}` });
    }
  }

  const hashMatch = xml.match(/<hash>([a-f0-9]{32})<\/hash>/i);
  if (!hashMatch) {
    errors.push({ field: "hash", message: "Hash MD5 inválido ou ausente no epílogo" });
  }

  if (!xml.includes('xmlns="http://www.ans.gov.br/padroes/tiss/schemas"')) {
    errors.push({ field: "xmlns", message: "Namespace TISS ANS ausente" });
  }

  if (!xml.includes('versao="3.05.00"')) {
    errors.push({ field: "versao", message: "Atributo versao deve ser 3.05.00" });
  }

  return errors;
}
