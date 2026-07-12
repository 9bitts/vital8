/** Tipos FHIR R4 mínimos para serialização Vital8 ↔ RNDS. */

export type FhirMeta = {
  profile?: string[];
  lastUpdated?: string;
  versionId?: string;
};

export type FhirIdentifier = {
  system?: string;
  value?: string;
  use?: "usual" | "official" | "temp" | "secondary";
};

export type FhirHumanName = {
  use?: string;
  text?: string;
  family?: string;
  given?: string[];
};

export type FhirCodeableConcept = {
  coding?: Array<{ system?: string; code?: string; display?: string }>;
  text?: string;
};

export type FhirReference = {
  reference?: string;
  display?: string;
};

export type FhirPeriod = {
  start?: string;
  end?: string;
};

export type FhirQuantity = {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
};

export type FhirContactPoint = {
  system?: "phone" | "email" | "fax" | "pager" | "url" | "sms" | "other";
  value?: string;
  use?: string;
};

export type FhirAddress = {
  use?: string;
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export type FhirResourceBase = {
  resourceType: string;
  id?: string;
  meta?: FhirMeta;
};

export type FhirPatient = FhirResourceBase & {
  resourceType: "Patient";
  identifier?: FhirIdentifier[];
  active?: boolean;
  name?: FhirHumanName[];
  telecom?: FhirContactPoint[];
  gender?: "male" | "female" | "other" | "unknown";
  birthDate?: string;
  address?: FhirAddress[];
};

export type FhirPractitioner = FhirResourceBase & {
  resourceType: "Practitioner";
  identifier?: FhirIdentifier[];
  active?: boolean;
  name?: FhirHumanName[];
};

export type FhirPractitionerRole = FhirResourceBase & {
  resourceType: "PractitionerRole";
  practitioner?: FhirReference;
  organization?: FhirReference;
  code?: FhirCodeableConcept[];
  specialty?: FhirCodeableConcept[];
};

export type FhirOrganization = FhirResourceBase & {
  resourceType: "Organization";
  identifier?: FhirIdentifier[];
  active?: boolean;
  name?: string;
  telecom?: FhirContactPoint[];
  address?: FhirAddress[];
};

export type FhirLocation = FhirResourceBase & {
  resourceType: "Location";
  identifier?: FhirIdentifier[];
  status?: "active" | "inactive";
  name?: string;
  address?: FhirAddress;
  managingOrganization?: FhirReference;
};

export type FhirAppointment = FhirResourceBase & {
  resourceType: "Appointment";
  status?: string;
  serviceType?: FhirCodeableConcept[];
  start?: string;
  end?: string;
  participant?: Array<{
    actor?: FhirReference;
    status?: string;
    required?: string;
  }>;
};

export type FhirEncounter = FhirResourceBase & {
  resourceType: "Encounter";
  status?: string;
  class?: FhirCodeableConcept;
  subject?: FhirReference;
  participant?: Array<{
    individual?: FhirReference;
    type?: FhirCodeableConcept[];
  }>;
  period?: FhirPeriod;
  serviceProvider?: FhirReference;
  appointment?: FhirReference[];
};

export type FhirCondition = FhirResourceBase & {
  resourceType: "Condition";
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  onsetDateTime?: string;
};

export type FhirAllergyIntolerance = FhirResourceBase & {
  resourceType: "AllergyIntolerance";
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  type?: string;
  category?: string[];
  code?: FhirCodeableConcept;
  patient?: FhirReference;
};

export type FhirMedicationRequest = FhirResourceBase & {
  resourceType: "MedicationRequest";
  status?: string;
  intent?: string;
  medicationCodeableConcept?: FhirCodeableConcept;
  subject?: FhirReference;
  authoredOn?: string;
  requester?: FhirReference;
  dosageInstruction?: Array<{
    text?: string;
    route?: FhirCodeableConcept;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
  }>;
  dispenseRequest?: { quantity?: FhirQuantity };
};

export type FhirObservation = FhirResourceBase & {
  resourceType: "Observation";
  status?: string;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  effectiveDateTime?: string;
  valueQuantity?: FhirQuantity;
  valueString?: string;
  referenceRange?: Array<{ text?: string; low?: FhirQuantity; high?: FhirQuantity }>;
};

export type FhirDiagnosticReport = FhirResourceBase & {
  resourceType: "DiagnosticReport";
  status?: string;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  effectiveDateTime?: string;
  issued?: string;
  performer?: FhirReference[];
  result?: FhirReference[];
  basedOn?: FhirReference[];
};

export type FhirServiceRequest = FhirResourceBase & {
  resourceType: "ServiceRequest";
  status?: string;
  intent?: string;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  authoredOn?: string;
  requester?: FhirReference;
  note?: Array<{ text?: string }>;
};

export type FhirDocumentReference = FhirResourceBase & {
  resourceType: "DocumentReference";
  status?: string;
  type?: FhirCodeableConcept;
  subject?: FhirReference;
  date?: string;
  content?: Array<{
    attachment?: { contentType?: string; title?: string; url?: string };
  }>;
};

export type FhirImmunization = FhirResourceBase & {
  resourceType: "Immunization";
  status?: string;
  vaccineCode?: FhirCodeableConcept;
  patient?: FhirReference;
  occurrenceDateTime?: string;
  primarySource?: boolean;
};

export type FhirBundleEntry = {
  fullUrl?: string;
  resource?: FhirResourceBase;
};

export type FhirBundle = FhirResourceBase & {
  resourceType: "Bundle";
  type: "document" | "collection" | "transaction" | "batch";
  timestamp?: string;
  identifier?: FhirIdentifier;
  entry?: FhirBundleEntry[];
};

export type FhirOperationOutcomeIssue = {
  severity: "fatal" | "error" | "warning" | "information";
  code: string;
  diagnostics?: string;
  details?: FhirCodeableConcept;
};

export type FhirOperationOutcome = FhirResourceBase & {
  resourceType: "OperationOutcome";
  issue: FhirOperationOutcomeIssue[];
};

export type FhirResource =
  | FhirPatient
  | FhirPractitioner
  | FhirPractitionerRole
  | FhirOrganization
  | FhirLocation
  | FhirAppointment
  | FhirEncounter
  | FhirCondition
  | FhirAllergyIntolerance
  | FhirMedicationRequest
  | FhirObservation
  | FhirDiagnosticReport
  | FhirServiceRequest
  | FhirDocumentReference
  | FhirImmunization
  | FhirBundle
  | FhirOperationOutcome;
