import { BR_IDENTIFIER_SYSTEMS, BR_PROFILES, vital8Ref } from "../lib/identifiers";
import type { FhirLocation, FhirOrganization } from "../types/fhir-types";
import type { Vital8Location, Vital8Organization } from "../types/vital8-types";

export function organizationToFhir(o: Vital8Organization): FhirOrganization {
  return {
    resourceType: "Organization",
    id: o.id,
    meta: { profile: [BR_PROFILES.ORGANIZATION], lastUpdated: o.updatedAt },
    identifier: [
      { system: vital8Ref("Organization", o.id), value: o.id },
      { system: "urn:oid:2.16.76.1.3.3", value: o.documentNumber, use: "official" },
    ],
    active: true,
    name: o.name,
    telecom: [
      ...(o.phone ? [{ system: "phone" as const, value: o.phone }] : []),
      ...(o.email ? [{ system: "email" as const, value: o.email }] : []),
    ],
  };
}

export function locationToFhir(l: Vital8Location): FhirLocation {
  const addr = l.address as { line?: string; city?: string; state?: string; zip?: string } | undefined;
  return {
    resourceType: "Location",
    id: l.id,
    meta: { profile: [BR_PROFILES.LOCATION], lastUpdated: l.updatedAt },
    identifier: [
      { system: vital8Ref("Location", l.id), value: l.id },
      ...(l.cnes ? [{ system: BR_IDENTIFIER_SYSTEMS.CNES, value: l.cnes, use: "official" as const }] : []),
    ],
    status: l.isActive ? "active" : "inactive",
    name: l.name,
    address: addr
      ? {
          line: addr.line ? [addr.line] : undefined,
          city: addr.city,
          state: addr.state,
          postalCode: addr.zip,
          country: "BR",
        }
      : undefined,
    managingOrganization: { reference: `Organization/${l.organizationId}` },
  };
}

export function locationFromFhir(fhir: FhirLocation, organizationId: string): Vital8Location {
  const cnes = fhir.identifier?.find((i) => i.system === BR_IDENTIFIER_SYSTEMS.CNES)?.value ?? null;
  return {
    id: fhir.id ?? "",
    organizationId,
    name: fhir.name ?? "",
    cnes,
    address: fhir.address
      ? {
          line: fhir.address.line?.[0],
          city: fhir.address.city,
          state: fhir.address.state,
          zip: fhir.address.postalCode,
        }
      : {},
    isActive: fhir.status !== "inactive",
    updatedAt: fhir.meta?.lastUpdated ?? new Date().toISOString(),
  };
}

export function organizationFromFhir(fhir: FhirOrganization): Vital8Organization {
  const doc = fhir.identifier?.find((i) => i.system === "urn:oid:2.16.76.1.3.3")?.value ?? "";
  return {
    id: fhir.id ?? "",
    name: fhir.name ?? "",
    documentNumber: doc,
    phone: fhir.telecom?.find((t) => t.system === "phone")?.value ?? null,
    email: fhir.telecom?.find((t) => t.system === "email")?.value ?? null,
    updatedAt: fhir.meta?.lastUpdated ?? new Date().toISOString(),
  };
}
