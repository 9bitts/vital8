import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminPrisma } from "@/lib/db/admin-client";
import { createTenantClient } from "@/lib/db/tenant-client";
import { encryptPHI } from "@/lib/crypto/phi";
import { isDatabaseAvailable } from "@/lib/test/db-available";
import {
  clearRndsTokenCacheForTests,
  getRndsAdapter,
  getRndsToken,
  simulateTokenExpiry,
} from "@/lib/integrations/rnds";
import {
  enqueueRndsSubmission,
  processRndsSubmissions,
  retryRndsSubmission,
} from "@/modules/interoperability/services/rnds-submission.service";
import { upsertRndsCredential } from "@/modules/interoperability/services/rnds-credential.service";
import {
  reconcileLabResult,
  sendExamRequestToLab,
} from "@/modules/interoperability/services/lab-reconciliation.service";
import { clearMockLabOrdersForTests, getLabIntegrationAdapter } from "@/lib/integrations/lab-integration";
import { buildRacBundleFromEncounter } from "@/modules/fhir/services/rac-bundle.service";
import { FHIR_RESOURCE_SCOPES } from "@/modules/fhir/services/fhir-read.service";
import { hasScope } from "@/modules/api/lib/scopes";

describe("Interoperability Phase 13", () => {
  let dbAvailable = false;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) return;

    const ts = Date.now();
    const orgA = await adminPrisma.organization.create({
      data: {
        name: "Interop A",
        slug: `interop-a-${ts}`,
        documentType: "CNPJ",
        documentNumber: "11222333000181",
        plan: "ENTERPRISE",
        type: "CLINICA",
      },
    });
    const orgB = await adminPrisma.organization.create({
      data: {
        name: "Interop B",
        slug: `interop-b-${ts}`,
        documentType: "CNPJ",
        documentNumber: "11444777000161",
        plan: "ENTERPRISE",
        type: "CLINICA",
      },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    await adminPrisma.subscription.createMany({
      data: [
        { organizationId: orgAId, plan: "ENTERPRISE", status: "ATIVA" },
        { organizationId: orgBId, plan: "ENTERPRISE", status: "ATIVA" },
      ],
    });
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    await adminPrisma.labResultReconciliation.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.rndsSubmission.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.rndsCredential.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.interoperabilitySettings.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.examResultValue.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.examResult.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.examRequestItem.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.examRequest.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.encounterSection.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.encounter.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.professional.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.patient.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.subscription.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await adminPrisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
    clearRndsTokenCacheForTests();
    clearMockLabOrdersForTests();
  });

  it("renova token RNDS após expiração simulada (15 min)", async () => {
    if (!dbAvailable) return;
    const adapter = getRndsAdapter();
    const config = {
      environment: "HOMOLOGACAO" as const,
      requesterId: "TEST-REQ",
      certificateEncrypted: encryptPHI("mock-cert"),
    };
    const t1 = await getRndsToken(adapter, config);
    simulateTokenExpiry(config);
    const t2 = await getRndsToken(adapter, config);
    expect(t1).not.toBe(t2);
  });

  it("certificado armazenado criptografado", async () => {
    if (!dbAvailable) return;
    const db = createTenantClient(orgAId);
    const cred = await upsertRndsCredential(db, orgAId, {
      certificateType: "A1",
      certificateBase64: "SECRET-PFX-DATA",
      requesterId: "REQ-001",
      environment: "HOMOLOGACAO",
      credentialStatus: "HOMOLOGACAO",
    });
    expect(cred.certificateEncrypted).toBeTruthy();
    expect(cred.certificateEncrypted).not.toContain("SECRET-PFX-DATA");
  });

  it("isolamento multi-tenant em credencial e submissão", async () => {
    if (!dbAvailable) return;
    const dbA = createTenantClient(orgAId);
    const dbB = createTenantClient(orgBId);

    const credA = await upsertRndsCredential(dbA, orgAId, {
      certificateType: "A1",
      certificateBase64: "cert-a",
      requesterId: "A-REQ",
      environment: "HOMOLOGACAO",
      credentialStatus: "HOMOLOGACAO",
    });

    await upsertRndsCredential(dbB, orgBId, {
      certificateType: "A1",
      certificateBase64: "cert-b",
      requesterId: "B-REQ",
      environment: "HOMOLOGACAO",
      credentialStatus: "HOMOLOGACAO",
    });

    const prof = await dbA.professional.create({
      data: { organizationId: orgAId, displayName: "Dr Test" },
    });
    const patient = await dbA.patient.create({
      data: {
        organizationId: orgAId,
        searchName: "pac interop",
        fullName: "Pac Interop",
        cpfEncrypted: encryptPHI("52998224725"),
        cnsEncrypted: encryptPHI("898001234567890"),
      },
    });
    const enc = await dbA.encounter.create({
      data: {
        organizationId: orgAId,
        patientId: patient.id,
        professionalId: prof.id,
        authorUserId: "user-test",
        status: "ASSINADO",
        signedAt: new Date(),
        endedAt: new Date(),
      },
    });
    await dbA.encounterSection.create({
      data: {
        organizationId: orgAId,
        encounterId: enc.id,
        sectionType: "HIPOTESE_DIAGNOSTICA",
        structuredData: { cidCodes: ["J06.9"] },
      },
    });

    const bundle = await buildRacBundleFromEncounter(dbA, orgAId, enc.id);
    expect(bundle.entry?.length).toBeGreaterThan(0);

    const sub = await adminPrisma.rndsSubmission.create({
      data: {
        organizationId: orgAId,
        credentialId: credA.id,
        registrationType: "RAC",
        sourceType: "ENCOUNTER",
        sourceId: enc.id,
        bundleJson: bundle as object,
        status: "FILA",
      },
    });

    const cross = await dbB.rndsSubmission.findFirst({ where: { id: sub.id } });
    expect(cross).toBeNull();
  });

  it("retry e DLQ de submissão RNDS", async () => {
    if (!dbAvailable) return;
    const db = createTenantClient(orgAId);
    await upsertRndsCredential(db, orgAId, {
      certificateType: "A1",
      certificateBase64: "cert-retry",
      requesterId: "RETRY-REQ",
      environment: "HOMOLOGACAO",
      credentialStatus: "HOMOLOGACAO",
    });

    const prof = await db.professional.create({
      data: { organizationId: orgAId, displayName: "Dr Retry" },
    });
    const patient = await db.patient.create({
      data: {
        organizationId: orgAId,
        searchName: "retry pac",
        fullName: "Retry Pac",
        cpfEncrypted: encryptPHI("11144477735"),
        cnsEncrypted: encryptPHI("898001234567890"),
      },
    });
    const enc = await db.encounter.create({
      data: {
        organizationId: orgAId,
        patientId: patient.id,
        professionalId: prof.id,
        authorUserId: "user-retry",
        status: "ASSINADO",
        signedAt: new Date(),
        endedAt: new Date(),
      },
    });

    const sub = await enqueueRndsSubmission(db, orgAId, {
      registrationType: "RAC",
      sourceType: "ENCOUNTER",
      sourceId: enc.id,
    });

    await processRndsSubmissions(10);
    const after = await adminPrisma.rndsSubmission.findUniqueOrThrow({
      where: { id: sub.id },
    });
    expect(["ACEITO", "REJEITADO", "ENVIADO"]).toContain(after.status);

    await adminPrisma.rndsSubmission.update({
      where: { id: sub.id },
      data: { status: "DLQ", attemptCount: 5 },
    });
    await retryRndsSubmission(db, orgAId, sub.id);
    const retried = await adminPrisma.rndsSubmission.findUniqueOrThrow({
      where: { id: sub.id },
    });
    expect(retried.status).toBe("FILA");
    expect(retried.attemptCount).toBe(0);
  });

  it("conciliação de resultado — match exato e ambíguo", async () => {
    if (!dbAvailable) return;
    const db = createTenantClient(orgAId);
    const prof = await db.professional.create({
      data: { organizationId: orgAId, displayName: "Dr Lab" },
    });
    const patient = await db.patient.create({
      data: {
        organizationId: orgAId,
        searchName: "lab pac",
        fullName: "Lab Pac",
      },
    });
    const enc = await db.encounter.create({
      data: {
        organizationId: orgAId,
        patientId: patient.id,
        professionalId: prof.id,
        authorUserId: "user-lab",
        status: "RASCUNHO",
      },
    });
    const request = await db.examRequest.create({
      data: {
        organizationId: orgAId,
        encounterId: enc.id,
        patientId: patient.id,
        authorUserId: "user-lab",
        items: { create: [{ organizationId: orgAId, examName: "Hemograma" }] },
      },
    });

    await sendExamRequestToLab(db, orgAId, request.id);
    const adapter = getLabIntegrationAdapter();
    const payload = await adapter.simulateResult!(request.id);
    const exact = await reconcileLabResult(db, orgAId, payload);
    expect(exact.status).toBe("CONCILIADO");

    const ambiguous = await reconcileLabResult(db, orgAId, {
      externalRequestId: "",
      diagnosticReport: {
        resourceType: "DiagnosticReport",
        status: "final",
        code: { text: "Exame" },
        subject: { reference: `Patient/${patient.id}` },
      },
      observations: [],
    });
    expect(ambiguous.status).toBe("PENDENTE");
  });

  it("endpoint FHIR respeita escopos", () => {
    expect(hasScope(["patients:read", "fhir:read"], FHIR_RESOURCE_SCOPES.Patient)).toBe(true);
    expect(hasScope(["appointments:read"], FHIR_RESOURCE_SCOPES.Patient)).toBe(false);
    expect(hasScope(["encounters:read"], FHIR_RESOURCE_SCOPES.DiagnosticReport)).toBe(true);
    expect(hasScope(["lab:inbound"], ["lab:inbound"])).toBe(true);
  });
});
