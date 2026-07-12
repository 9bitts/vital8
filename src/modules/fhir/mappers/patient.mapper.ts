import { BR_IDENTIFIER_SYSTEMS, BR_PROFILES, vital8Ref } from "../lib/identifiers";
import type { FhirPatient } from "../types/fhir-types";
import type { Vital8Patient } from "../types/vital8-types";

function sexToFhir(sex: Vital8Patient["sex"]): FhirPatient["gender"] {
  if (sex === "MASCULINO") return "male";
  if (sex === "FEMININO") return "female";
  if (sex === "INTERSEX") return "other";
  return "unknown";
}

function sexFromFhir(gender?: FhirPatient["gender"]): Vital8Patient["sex"] {
  if (gender === "male") return "MASCULINO";
  if (gender === "female") return "FEMININO";
  if (gender === "other") return "INTERSEX";
  return "NAO_INFORMADO";
}

export function patientToFhir(p: Vital8Patient): FhirPatient {
  const identifiers: FhirPatient["identifier"] = [
    { system: vital8Ref("Patient", p.id), value: p.id, use: "secondary" },
  ];
  if (p.cpf) identifiers.push({ system: BR_IDENTIFIER_SYSTEMS.CPF, value: p.cpf, use: "official" });
  if (p.cns) identifiers.push({ system: BR_IDENTIFIER_SYSTEMS.CNS, value: p.cns, use: "official" });

  const names: FhirPatient["name"] = [{ text: p.fullName, given: [p.fullName] }];
  if (p.socialName) names.push({ use: "usual", text: p.socialName });

  const telecom: FhirPatient["telecom"] = [];
  if (p.phone) telecom.push({ system: "phone", value: p.phone, use: "mobile" });
  if (p.email) telecom.push({ system: "email", value: p.email });

  return {
    resourceType: "Patient",
    id: p.id,
    meta: { profile: [BR_PROFILES.PATIENT], lastUpdated: p.updatedAt },
    identifier: identifiers,
    active: p.isActive,
    name: names,
    telecom: telecom.length ? telecom : undefined,
    gender: sexToFhir(p.sex),
    birthDate: p.birthDate ?? undefined,
  };
}

export function patientFromFhir(fhir: FhirPatient, organizationId: string): Vital8Patient {
  const vital8Id =
    fhir.identifier?.find((i) => i.system === vital8Ref("Patient", fhir.id ?? ""))?.value ??
    fhir.id ??
    "";

  const cpf = fhir.identifier?.find((i) => i.system === BR_IDENTIFIER_SYSTEMS.CPF)?.value ?? null;
  const cns = fhir.identifier?.find((i) => i.system === BR_IDENTIFIER_SYSTEMS.CNS)?.value ?? null;
  const usualName = fhir.name?.find((n) => n.use === "usual")?.text;
  const officialName = fhir.name?.find((n) => n.use !== "usual")?.text ?? fhir.name?.[0]?.text ?? "";

  return {
    id: vital8Id,
    organizationId,
    fullName: officialName,
    socialName: usualName ?? null,
    cpf,
    cns,
    birthDate: fhir.birthDate ?? null,
    sex: sexFromFhir(fhir.gender),
    phone: fhir.telecom?.find((t) => t.system === "phone")?.value ?? null,
    email: fhir.telecom?.find((t) => t.system === "email")?.value ?? null,
    isActive: fhir.active ?? true,
    updatedAt: fhir.meta?.lastUpdated ?? new Date().toISOString(),
  };
}
