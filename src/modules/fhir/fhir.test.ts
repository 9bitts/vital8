import { describe, it, expect } from "vitest";
import {
  patientToFhir,
  patientFromFhir,
  practitionerToFhir,
  practitionerFromFhir,
  organizationToFhir,
  organizationFromFhir,
  locationToFhir,
  locationFromFhir,
  appointmentToFhir,
  appointmentFromFhir,
  encounterToFhir,
  encounterFromFhir,
  conditionToFhir,
  conditionFromFhir,
  allergyToFhir,
  allergyFromFhir,
  medicationRequestToFhir,
  medicationRequestFromFhir,
  observationToFhir,
  observationFromFhir,
  diagnosticReportWithObservations,
  serviceRequestToFhir,
  serviceRequestFromFhir,
  documentReferenceToFhir,
  documentReferenceFromFhir,
  immunizationToFhir,
  immunizationFromFhir,
  createRacBundle,
} from "./mappers";
import { assertValidFhirResource, validateFhirResource } from "./lib/validator";
import { isOutOfReference } from "./mappers/observation.mapper";

const ORG = "org-test";
const NOW = "2026-07-12T10:00:00.000Z";

describe("FHIR mappers round-trip", () => {
  it("Patient", () => {
    const original = {
      id: "pat-1",
      organizationId: ORG,
      fullName: "Maria Silva",
      socialName: "Maria",
      cpf: "52998224725",
      cns: "898001234567890",
      birthDate: "1990-05-15",
      sex: "FEMININO" as const,
      phone: "11999990000",
      email: "maria@test.com",
      isActive: true,
      updatedAt: NOW,
    };
    const fhir = patientToFhir(original);
    assertValidFhirResource(fhir);
    const back = patientFromFhir(fhir, ORG);
    expect(back.fullName).toBe(original.fullName);
    expect(back.cpf).toBe(original.cpf);
    expect(back.cns).toBe(original.cns);
    expect(back.sex).toBe("FEMININO");
    expect(back.birthDate).toBe(original.birthDate);
  });

  it("Practitioner", () => {
    const original = {
      id: "prof-1",
      organizationId: ORG,
      displayName: "Dr. João",
      councilType: "CRM",
      councilNumber: "123456",
      councilState: "SP",
      specialties: ["Clínica Geral"],
      isActive: true,
      updatedAt: NOW,
    };
    const fhir = practitionerToFhir(original);
    assertValidFhirResource(fhir);
    const back = practitionerFromFhir(fhir, ORG);
    expect(back.displayName).toBe(original.displayName);
    expect(back.councilType).toBe("CRM");
    expect(back.councilNumber).toBe("123456");
  });

  it("Organization and Location", () => {
    const org = {
      id: ORG,
      name: "Clínica Teste",
      documentNumber: "11222333000181",
      phone: "1133334444",
      email: "contato@test.com",
      updatedAt: NOW,
    };
    const loc = {
      id: "branch-1",
      organizationId: ORG,
      name: "Unidade Centro",
      cnes: "1234567",
      address: { line: "Rua A, 100", city: "São Paulo", state: "SP", zip: "01000-000" },
      isActive: true,
      updatedAt: NOW,
    };
    const fhirOrg = organizationToFhir(org);
    const fhirLoc = locationToFhir(loc);
    assertValidFhirResource(fhirOrg);
    assertValidFhirResource(fhirLoc);
    expect(organizationFromFhir(fhirOrg).name).toBe(org.name);
    expect(locationFromFhir(fhirLoc, ORG).cnes).toBe(loc.cnes);
  });

  it("Appointment", () => {
    const original = {
      id: "appt-1",
      organizationId: ORG,
      patientId: "pat-1",
      professionalId: "prof-1",
      serviceId: "svc-1",
      branchId: "branch-1",
      status: "CONFIRMADO",
      startsAt: NOW,
      endsAt: NOW,
      updatedAt: NOW,
    };
    const fhir = appointmentToFhir(original);
    assertValidFhirResource(fhir);
    const back = appointmentFromFhir(fhir, ORG);
    expect(back.patientId).toBe(original.patientId);
    expect(back.status).toBe(original.status);
  });

  it("Encounter", () => {
    const original = {
      id: "enc-1",
      organizationId: ORG,
      patientId: "pat-1",
      professionalId: "prof-1",
      appointmentId: "appt-1",
      status: "ASSINADO",
      modality: "PRESENCIAL",
      specialty: "medicina_geral",
      startedAt: NOW,
      endedAt: NOW,
      signedAt: NOW,
      contentHash: "abc123",
      updatedAt: NOW,
    };
    const fhir = encounterToFhir(original);
    assertValidFhirResource(fhir);
    const back = encounterFromFhir(fhir, ORG);
    expect(back.status).toBe("ASSINADO");
    expect(back.patientId).toBe(original.patientId);
  });

  it("Condition (CID-10)", () => {
    const original = {
      id: "cond-1",
      patientId: "pat-1",
      cidCode: "J06.9",
      description: "IVAS",
      updatedAt: NOW,
    };
    const fhir = conditionToFhir(original);
    const issues = validateFhirResource(fhir);
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
    const back = conditionFromFhir(fhir, "pat-1");
    expect(back.cidCode).toBe("J06.9");
  });

  it("AllergyIntolerance", () => {
    const original = {
      id: "all-1",
      patientId: "pat-1",
      substance: "Dipirona",
      severity: "grave",
      updatedAt: NOW,
    };
    const fhir = allergyToFhir(original);
    assertValidFhirResource(fhir);
    expect(allergyFromFhir(fhir, "pat-1").substance).toBe("Dipirona");
  });

  it("MedicationRequest", () => {
    const original = {
      id: "rx-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      drugName: "Paracetamol",
      dosage: "500mg",
      route: "oral",
      frequency: "8/8h",
      quantity: 20,
      signedAt: NOW,
      updatedAt: NOW,
    };
    const fhir = medicationRequestToFhir(original);
    assertValidFhirResource(fhir);
    const back = medicationRequestFromFhir(fhir, "pat-1", "enc-1");
    expect(back.drugName).toBe("Paracetamol");
    expect(back.quantity).toBe(20);
  });

  it("Observation and DiagnosticReport", () => {
    const obs = {
      id: "obs-1",
      patientId: "pat-1",
      resultId: "res-1",
      name: "Hemoglobina",
      value: "14.2",
      unit: "g/dL",
      referenceRange: "12-16",
      resultedAt: NOW,
    };
    const fhirObs = observationToFhir(obs);
    assertValidFhirResource(fhirObs);
    const backObs = observationFromFhir(fhirObs, "pat-1", "res-1");
    expect(backObs.value).toBe("14.2");
    expect(backObs.referenceRange).toBe("12-16");
    expect(isOutOfReference("18", "12-16")).toBe(true);
    expect(isOutOfReference("14", "12-16")).toBe(false);

    const report = {
      id: "res-1",
      organizationId: ORG,
      patientId: "pat-1",
      requestId: "req-1",
      encounterId: "enc-1",
      fileName: "hemograma.pdf",
      mimeType: "application/pdf",
      resultedAt: NOW,
      observations: [obs],
      updatedAt: NOW,
    };
    const { report: dr } = diagnosticReportWithObservations(report);
    assertValidFhirResource(dr);
  });

  it("ServiceRequest", () => {
    const original = {
      id: "req-1",
      organizationId: ORG,
      patientId: "pat-1",
      encounterId: "enc-1",
      authorUserId: "user-1",
      items: [{ examName: "Hemograma", instructions: "Jejum 8h" }],
      createdAt: NOW,
    };
    const fhir = serviceRequestToFhir(original);
    assertValidFhirResource(fhir);
    const back = serviceRequestFromFhir(fhir, ORG, "enc-1", "user-1");
    expect(back.items[0].examName).toBe("Hemograma");
  });

  it("DocumentReference", () => {
    const original = {
      id: "doc-1",
      patientId: "pat-1",
      fileName: "laudo.pdf",
      mimeType: "application/pdf",
      storageKey: "org/pat/laudo.pdf",
      category: "EXAME",
      createdAt: NOW,
    };
    const fhir = documentReferenceToFhir(original);
    assertValidFhirResource(fhir);
    expect(documentReferenceFromFhir(fhir, "pat-1").storageKey).toBe(original.storageKey);
  });

  it("Immunization (estrutura pronta)", () => {
    const original = {
      id: "imm-1",
      patientId: "pat-1",
      vaccineCode: "33",
      vaccineDisplay: "Vacina influenza",
      occurrenceDate: NOW,
    };
    const fhir = immunizationToFhir(original);
    assertValidFhirResource(fhir);
    expect(immunizationFromFhir(fhir, "pat-1").vaccineDisplay).toBe("Vacina influenza");
  });

  it("Bundle RAC válido", () => {
    const patient = patientToFhir({
      id: "pat-1",
      organizationId: ORG,
      fullName: "Teste",
      cpf: "52998224725",
      cns: "898001234567890",
      isActive: true,
      updatedAt: NOW,
    });
    const enc = encounterToFhir({
      id: "enc-1",
      organizationId: ORG,
      patientId: "pat-1",
      professionalId: "prof-1",
      status: "ASSINADO",
      modality: "PRESENCIAL",
      startedAt: NOW,
      endedAt: NOW,
      signedAt: NOW,
      updatedAt: NOW,
    });
    const bundle = createRacBundle([patient, enc]);
    assertValidFhirResource(bundle);
    expect(bundle.entry?.length).toBe(2);
  });
});
