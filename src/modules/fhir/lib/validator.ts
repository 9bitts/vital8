import type { FhirResource, FhirResourceBase } from "../types/fhir-types";
import { BR_IDENTIFIER_SYSTEMS, BR_TERMINOLOGY } from "./identifiers";

export type ValidationIssue = {
  path: string;
  message: string;
  severity: "error" | "warning";
};

const REQUIRED_FIELDS: Record<string, string[]> = {
  Patient: ["identifier", "name"],
  Practitioner: ["name"],
  Organization: ["name"],
  Location: ["name"],
  Appointment: ["status", "participant"],
  Encounter: ["status", "class", "subject"],
  Condition: ["code", "subject"],
  AllergyIntolerance: ["code", "patient"],
  MedicationRequest: ["status", "intent", "medicationCodeableConcept", "subject"],
  Observation: ["status", "code", "subject"],
  DiagnosticReport: ["status", "code", "subject"],
  ServiceRequest: ["status", "intent", "code", "subject"],
  DocumentReference: ["status", "content"],
  Immunization: ["status", "vaccineCode", "patient"],
  Bundle: ["type", "entry"],
};

export function validateFhirResource(resource: FhirResourceBase): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const required = REQUIRED_FIELDS[resource.resourceType] ?? [];

  for (const field of required) {
    const value = (resource as Record<string, unknown>)[field];
    if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
      issues.push({
        path: `${resource.resourceType}.${field}`,
        message: `Campo obrigatório ausente: ${field}`,
        severity: "error",
      });
    }
  }

  if (resource.resourceType === "Patient") {
    const patient = resource as FhirResource & { resourceType: "Patient" };
    const hasBrId = patient.identifier?.some(
      (i) => i.system === BR_IDENTIFIER_SYSTEMS.CPF || i.system === BR_IDENTIFIER_SYSTEMS.CNS,
    );
    if (!hasBrId) {
      issues.push({
        path: "Patient.identifier",
        message: "Perfil BR requer CPF ou CNS",
        severity: "warning",
      });
    }
  }

  if (resource.resourceType === "Condition") {
    const condition = resource as FhirResource & { resourceType: "Condition" };
    const hasCid = condition.code?.coding?.some((c) => c.system === BR_TERMINOLOGY.CID10);
    if (!hasCid) {
      issues.push({
        path: "Condition.code",
        message: "CID-10 recomendado no coding",
        severity: "warning",
      });
    }
  }

  if (resource.resourceType === "Bundle") {
    const bundle = resource as FhirResource & { resourceType: "Bundle" };
    if (!bundle.entry?.length) {
      issues.push({ path: "Bundle.entry", message: "Bundle vazio", severity: "error" });
    }
  }

  return issues;
}

export function assertValidFhirResource(resource: FhirResourceBase): void {
  const errors = validateFhirResource(resource).filter((i) => i.severity === "error");
  if (errors.length) {
    throw new Error(`FHIR inválido: ${errors.map((e) => e.message).join("; ")}`);
  }
}
