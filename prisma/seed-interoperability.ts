import type { PrismaClient } from "../src/generated/prisma/client";
import { encryptPHI } from "../src/lib/crypto/phi";
import { buildRacBundleFromEncounter } from "../src/modules/fhir/services/rac-bundle.service";
import { reconcileLabResult } from "../src/modules/interoperability/services/lab-reconciliation.service";
import { getLabIntegrationAdapter } from "../src/lib/integrations/lab-integration";
import { createTenantClient } from "../src/lib/db/tenant-client";

export async function seedInteroperability(
  prisma: PrismaClient,
  orgId: string,
  authorUserId: string,
) {
  const branch = await prisma.branch.findFirst({
    where: { organizationId: orgId, isMain: true },
  });

  const credential = await prisma.rndsCredential.upsert({
    where: { id: "seed-rnds-credential" },
    update: {},
    create: {
      id: "seed-rnds-credential",
      organizationId: orgId,
      branchId: branch?.id ?? null,
      certificateType: "A1",
      certificateEncrypted: encryptPHI("MOCK-PFX-BASE64-HOMOLOGACAO"),
      requesterId: "MOCK-SOLICITANTE-VITAL8-001",
      environment: "HOMOLOGACAO",
      credentialStatus: "HOMOLOGACAO",
      lastConnectionOk: true,
      lastConnectionTestAt: new Date(),
    },
  });

  await prisma.interoperabilitySettings.upsert({
    where: { organizationId: orgId },
    update: {
      autoSendRac: true,
      autoSendExamResults: true,
      labIntegrationEnabled: true,
    },
    create: {
      organizationId: orgId,
      autoSendRac: true,
      autoSendExamResults: true,
      labIntegrationEnabled: true,
      labPollingEnabled: false,
    },
  });

  const signedEncounter = await prisma.encounter.findFirst({
    where: { organizationId: orgId, status: "ASSINADO" },
    orderBy: { signedAt: "asc" },
  });

  if (signedEncounter) {
    const db = createTenantClient(orgId);
    const racBundle = await buildRacBundleFromEncounter(db, orgId, signedEncounter.id);

    await prisma.rndsSubmission.upsert({
      where: { id: "seed-rnds-aceito" },
      update: {},
      create: {
        id: "seed-rnds-aceito",
        organizationId: orgId,
        credentialId: credential.id,
        registrationType: "RAC",
        sourceType: "ENCOUNTER",
        sourceId: signedEncounter.id,
        bundleJson: racBundle as object,
        protocol: "RNDS-HOM-RAC-SEED001",
        status: "ACEITO",
        responseJson: {
          resourceType: "Bundle",
          type: "transaction-response",
        },
        attemptCount: 1,
        lastAttemptAt: new Date(),
      },
    });

    await prisma.rndsSubmission.upsert({
      where: { id: "seed-rnds-rejeitado" },
      update: {},
      create: {
        id: "seed-rnds-rejeitado",
        organizationId: orgId,
        credentialId: credential.id,
        registrationType: "RAC",
        sourceType: "ENCOUNTER",
        sourceId: signedEncounter.id,
        bundleJson: racBundle as object,
        protocol: "RNDS-HOM-RAC-REJ001",
        status: "REJEITADO",
        responseJson: {
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid-cpf",
              diagnostics: "CPF do paciente inválido ou ausente no perfil BR",
            },
          ],
        },
        errorMessage: "CPF do paciente inválido ou ausente no perfil BR",
        attemptCount: 1,
        lastAttemptAt: new Date(),
      },
    });

    await prisma.rndsSubmission.upsert({
      where: { id: "seed-rnds-fila" },
      update: {},
      create: {
        id: "seed-rnds-fila",
        organizationId: orgId,
        credentialId: credential.id,
        registrationType: "RAC",
        sourceType: "ENCOUNTER",
        sourceId: signedEncounter.id,
        bundleJson: racBundle as object,
        status: "FILA",
      },
    });
  }

  const examRequest = await prisma.examRequest.findFirst({
    where: { organizationId: orgId },
    include: { items: true, patient: true, encounter: true },
  });

  if (examRequest) {
    const adapter = getLabIntegrationAdapter();
    await adapter.sendOrder({
      requestId: examRequest.id,
      patientId: examRequest.patientId,
      patientName: examRequest.patient.fullName,
      exams: examRequest.items.map((i) => ({
        name: i.examName,
        instructions: i.instructions,
      })),
    });

    if (adapter.simulateResult) {
      const payload = await adapter.simulateResult(examRequest.id);
      const db = createTenantClient(orgId);
      await reconcileLabResult(db, orgId, payload);
    }
  }

  const patient = await prisma.patient.findFirst({ where: { organizationId: orgId } });
  if (patient && !patient.cnsEncrypted) {
    await prisma.patient.update({
      where: { id: patient.id },
      data: { cnsEncrypted: encryptPHI("898001234567890") },
    });
  }

  void authorUserId;
  console.log("  ✓ Interoperabilidade (FHIR/RNDS/lab) seed");
}
