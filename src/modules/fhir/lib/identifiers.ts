/** Identificadores e terminologias canônicas RNDS / perfis BR (FHIR R4). */

export const FHIR_VERSION = "4.0.1" as const;

export const BR_IDENTIFIER_SYSTEMS = {
  CPF: "http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf",
  CNS: "http://rnds.saude.gov.br/fhir/r4/NamingSystem/cns",
  CNES: "http://rnds.saude.gov.br/fhir/r4/NamingSystem/cnes",
  CRM: "http://rnds.saude.gov.br/fhir/r4/NamingSystem/crm",
  VITAL8: "urn:vital8:resource",
} as const;

export const BR_TERMINOLOGY = {
  CID10: "http://www.saude.gov.br/fhir/r4/CodeSystem/BRCID10",
  TUSS: "http://www.saude.gov.br/fhir/r4/CodeSystem/BRTabelaTUSS",
  GENDER: "http://hl7.org/fhir/administrative-gender",
  ENCOUNTER_CLASS: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  ALLERGY_CATEGORY: "http://hl7.org/fhir/allergy-intolerance-category",
  OBSERVATION_CATEGORY: "http://terminology.hl7.org/CodeSystem/observation-category",
  SERVICE_REQUEST_CATEGORY: "http://terminology.hl7.org/CodeSystem/servicerequest-category",
} as const;

export const BR_PROFILES = {
  PATIENT: "http://rnds.saude.gov.br/fhir/r4/StructureDefinition/BRIndividuo-1.0",
  PRACTITIONER: "http://rnds.saude.gov.br/fhir/r4/StructureDefinition/BRProfissional-1.0",
  ORGANIZATION: "http://rnds.saude.gov.br/fhir/r4/StructureDefinition/BREstabelecimentoSaude-1.0",
  LOCATION: "http://rnds.saude.gov.br/fhir/r4/StructureDefinition/BREstabelecimentoSaude-1.0",
  ENCOUNTER: "http://rnds.saude.gov.br/fhir/r4/StructureDefinition/BRAtendimento-1.0",
  CONDITION: "http://rnds.saude.gov.br/fhir/r4/StructureDefinition/BRCondicao-1.0",
  BUNDLE_RAC: "http://rnds.saude.gov.br/fhir/r4/StructureDefinition/BRRegistroAtendimentoClinico-1.0",
} as const;

export function vital8Ref(resourceType: string, id: string): string {
  return `${BR_IDENTIFIER_SYSTEMS.VITAL8}/${resourceType}/${id}`;
}

export function parseVital8Ref(reference: string): { type: string; id: string } | null {
  const prefix = `${BR_IDENTIFIER_SYSTEMS.VITAL8}/`;
  if (!reference.startsWith(prefix)) return null;
  const rest = reference.slice(prefix.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  return { type: rest.slice(0, slash), id: rest.slice(slash + 1) };
}
