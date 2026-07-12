import { BR_PROFILES } from "../lib/identifiers";
import type { FhirBundle, FhirResourceBase } from "../types/fhir-types";

export function createBundle(
  type: FhirBundle["type"],
  resources: FhirResourceBase[],
  options?: { profile?: string; identifier?: string },
): FhirBundle {
  return {
    resourceType: "Bundle",
    type,
    timestamp: new Date().toISOString(),
    meta: options?.profile ? { profile: [options.profile] } : undefined,
    identifier: options?.identifier
      ? { system: "urn:vital8:bundle", value: options.identifier }
      : undefined,
    entry: resources.map((r) => ({
      fullUrl: `urn:uuid:${r.id}`,
      resource: r,
    })),
  };
}

export function createRacBundle(resources: FhirResourceBase[]): FhirBundle {
  return createBundle("document", resources, { profile: BR_PROFILES.BUNDLE_RAC });
}

export function createExamResultBundle(resources: FhirResourceBase[]): FhirBundle {
  return createBundle("document", resources, {
    profile: "http://rnds.saude.gov.br/fhir/r4/StructureDefinition/BRResultadoExameLaboratorial-1.0",
  });
}
