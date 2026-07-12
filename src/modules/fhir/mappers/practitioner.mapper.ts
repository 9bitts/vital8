import { BR_IDENTIFIER_SYSTEMS, BR_PROFILES, vital8Ref } from "../lib/identifiers";
import type { FhirPractitioner, FhirPractitionerRole } from "../types/fhir-types";
import type { Vital8Professional } from "../types/vital8-types";

export function practitionerToFhir(p: Vital8Professional): FhirPractitioner {
  const identifiers: FhirPractitioner["identifier"] = [
    { system: vital8Ref("Practitioner", p.id), value: p.id, use: "secondary" },
  ];
  if (p.councilType && p.councilNumber) {
    identifiers.push({
      system: BR_IDENTIFIER_SYSTEMS.CRM,
      value: `${p.councilType}-${p.councilNumber}/${p.councilState ?? "BR"}`,
      use: "official",
    });
  }

  return {
    resourceType: "Practitioner",
    id: p.id,
    meta: { profile: [BR_PROFILES.PRACTITIONER], lastUpdated: p.updatedAt },
    identifier: identifiers,
    active: p.isActive,
    name: [{ text: p.displayName, given: [p.displayName] }],
  };
}

export function practitionerRoleToFhir(
  p: Vital8Professional,
  organizationId: string,
): FhirPractitionerRole {
  return {
    resourceType: "PractitionerRole",
    id: `${p.id}-role`,
    meta: { lastUpdated: p.updatedAt },
    practitioner: { reference: `Practitioner/${p.id}`, display: p.displayName },
    organization: { reference: `Organization/${organizationId}` },
    specialty: p.specialties.map((s) => ({ text: s })),
    code: p.councilType
      ? [{ text: `${p.councilType} ${p.councilNumber ?? ""}`.trim() }]
      : undefined,
  };
}

export function practitionerFromFhir(fhir: FhirPractitioner, organizationId: string): Vital8Professional {
  const councilId = fhir.identifier?.find((i) => i.system === BR_IDENTIFIER_SYSTEMS.CRM)?.value;
  let councilType: string | null = null;
  let councilNumber: string | null = null;
  let councilState: string | null = null;
  if (councilId) {
    const match = councilId.match(/^([A-Z]+)-([^/]+)\/(.+)$/);
    if (match) {
      councilType = match[1];
      councilNumber = match[2];
      councilState = match[3];
    }
  }

  return {
    id: fhir.id ?? "",
    organizationId,
    displayName: fhir.name?.[0]?.text ?? "",
    councilType,
    councilNumber,
    councilState,
    specialties: [],
    isActive: fhir.active ?? true,
    updatedAt: fhir.meta?.lastUpdated ?? new Date().toISOString(),
  };
}
